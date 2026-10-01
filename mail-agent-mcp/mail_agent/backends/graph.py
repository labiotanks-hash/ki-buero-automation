"""Outlook / Microsoft 365 über Microsoft Graph.

Rechte: delegiert, Device-Code-Anmeldung, Scopes Mail.ReadWrite und
Mail.ReadWrite.Shared. Mail.Send wird bewusst NICHT angefordert -- selbst ein
fehlerhafter Code-Pfad könnte damit nichts versenden.

ReadWrite ist nötig, weil Verschieben und Entwürfe Schreibvorgänge im Postfach
sind. Gelöscht wird nichts; es gibt dafür keine Methode.

Hinweis: Dieses Backend ist eine bereinigte Fassung des produktiv genutzten
Codes. Die automatischen Tests dieses Repos laufen gegen das Demo-Backend, nicht
gegen ein echtes Postfach.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import date
from pathlib import Path

from ..modelle import Entwurf, Mail
from . import Backend

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPES = ["Mail.ReadWrite", "Mail.ReadWrite.Shared"]
POSTEINGANG = {"posteingang", "inbox", "eingang"}
FELDER = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead"


class GraphBackend(Backend):
    def __init__(self, config: str | Path = "config.json", token_cache: str | Path = "token_cache.json"):
        try:
            import msal  # noqa: F401
            import requests  # noqa: F401
        except ImportError as e:  # pragma: no cover
            raise RuntimeError("Für das Graph-Backend: pip install 'mail-agent-mcp[graph]'") from e
        self._cfg = json.loads(Path(config).read_text(encoding="utf-8"))
        self._cache_pfad = Path(token_cache)
        self._token: str | None = None
        self._ordner_cache: dict[str, dict[str, str]] = {}

    # --- Anmeldung -------------------------------------------------------------
    def _token_holen(self) -> str:
        if self._token:
            return self._token
        import msal

        cache = msal.SerializableTokenCache()
        if self._cache_pfad.exists():
            cache.deserialize(self._cache_pfad.read_text())
        app = msal.PublicClientApplication(
            self._cfg["client_id"],
            authority=f"https://login.microsoftonline.com/{self._cfg['tenant_id']}",
            token_cache=cache,
        )
        ergebnis = None
        konten = app.get_accounts()
        if konten:
            ergebnis = app.acquire_token_silent(SCOPES, account=konten[0])
        if not ergebnis:
            flow = app.initiate_device_flow(scopes=SCOPES)
            # stderr: stdout gehört dem MCP-Protokoll
            print(flow["message"], file=sys.stderr)
            ergebnis = app.acquire_token_by_device_flow(flow)
        if "access_token" not in ergebnis:
            raise RuntimeError(f"Anmeldung fehlgeschlagen: {ergebnis.get('error_description')}")
        if cache.has_state_changed:
            self._cache_pfad.write_text(cache.serialize())
            os.chmod(self._cache_pfad, 0o600)
        self._token = ergebnis["access_token"]
        return self._token

    def _graph(self, methode: str, pfad: str, **kw):
        import requests

        url = pfad if pfad.startswith("http") else f"{GRAPH}{pfad}"
        for _ in range(5):
            r = requests.request(methode, url, headers={"Authorization": f"Bearer {self._token_holen()}"},
                                 timeout=60, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(int(r.headers.get("Retry-After", 5)))
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"Graph {r.status_code} {methode} {pfad}: {r.text[:400]}")
            return r.json() if r.content else {}
        raise RuntimeError(f"Graph {methode} {pfad}: nach 5 Versuchen keine Antwort.")

    def _basis(self, postfach: str) -> str:
        adresse = self.postfaecher().get(postfach)
        if not adresse:
            raise ValueError(f"Postfach '{postfach}' unbekannt. Vorhanden: {', '.join(self.postfaecher())}.")
        return f"/users/{adresse}"

    # --- Lesen -----------------------------------------------------------------
    def heute(self) -> date:
        return date.today()

    def postfaecher(self) -> dict[str, str]:
        return dict(self._cfg.get("postfaecher", {}))

    def _ordner_ids(self, postfach: str) -> dict[str, str]:
        if postfach not in self._ordner_cache:
            daten = self._graph("GET", f"{self._basis(postfach)}/mailFolders", params={"$top": "200"})
            self._ordner_cache[postfach] = {f["displayName"]: f["id"] for f in daten.get("value", [])}
        return self._ordner_cache[postfach]

    def ordner(self, postfach: str) -> dict[str, int]:
        daten = self._graph("GET", f"{self._basis(postfach)}/mailFolders", params={"$top": "200"})
        return {f["displayName"]: f.get("totalItemCount", 0) for f in daten.get("value", [])}

    def _ordner_id(self, postfach: str, name: str) -> str | None:
        if name.lower() in POSTEINGANG:
            return "inbox"  # sprachunabhängiger Name bei Graph
        return self._ordner_ids(postfach).get(name)

    def mails(self, postfach: str, ordner: str | None = None, seit: date | None = None) -> list[Mail]:
        basis = self._basis(postfach)
        oid = self._ordner_id(postfach, ordner or "Posteingang")
        if not oid:
            raise ValueError(f"Ordner '{ordner}' nicht gefunden.")
        params = {"$select": FELDER, "$top": "50"}
        if seit:
            params["$filter"] = f"receivedDateTime ge {seit.isoformat()}T00:00:00Z"
        url, kw, mails = f"{basis}/mailFolders/{oid}/messages", {"params": params}, []
        while url and len(mails) < 500:
            daten = self._graph("GET", url, **kw)
            for m in daten.get("value", []):
                mails.append(self._mail(m, postfach, ordner or "Posteingang"))
            url, kw = daten.get("@odata.nextLink"), {}
        return sorted(mails, key=lambda m: m.empfangen, reverse=True)

    @staticmethod
    def _mail(m: dict, postfach: str, ordner: str) -> Mail:
        adr = lambda feld: tuple(e["emailAddress"]["address"].lower() for e in m.get(feld) or [])  # noqa: E731
        von = (m.get("from") or {}).get("emailAddress", {})
        return Mail(id=m["id"], postfach=postfach, ordner=ordner, von_name=von.get("name", ""),
                    von=von.get("address", "").lower(), an=adr("toRecipients"), cc=adr("ccRecipients"),
                    betreff=m.get("subject") or "", empfangen=m.get("receivedDateTime", ""),
                    gelesen=m.get("isRead", True), anhang=m.get("hasAttachments", False),
                    text=" ".join((m.get("bodyPreview") or "").split()))

    # --- Verändern (nur Verschieben und Entwürfe) -------------------------------
    def _ordner_sicherstellen(self, postfach: str, pfad: str) -> str:
        basis, eltern_id, oid = self._basis(postfach), None, None
        for teil in pfad.split("/"):
            liste = (f"{basis}/mailFolders/{eltern_id}/childFolders" if eltern_id else f"{basis}/mailFolders")
            vorhanden = {f["displayName"]: f["id"] for f in self._graph("GET", liste, params={"$top": "200"})["value"]}
            oid = vorhanden.get(teil) or self._graph("POST", liste, json={"displayName": teil})["id"]
            eltern_id = oid
        self._ordner_cache.pop(postfach, None)
        return oid  # type: ignore[return-value]

    def verschieben(self, postfach: str, mail_ids: list[str], zielordner: str) -> int:
        ziel = self._ordner_sicherstellen(postfach, zielordner)
        for mid in mail_ids:
            self._graph("POST", f"{self._basis(postfach)}/messages/{mid}/move", json={"destinationId": ziel})
        return len(mail_ids)

    def entwurf_anlegen(self, postfach: str, an: list[str], betreff: str, text: str,
                        antwort_auf: str | None = None) -> Entwurf:
        basis = self._basis(postfach)
        empfaenger = [{"emailAddress": {"address": a}} for a in an]
        if antwort_auf:
            entwurf = self._graph("POST", f"{basis}/messages/{antwort_auf}/createReply")
            self._graph("PATCH", f"{basis}/messages/{entwurf['id']}",
                        json={"body": {"contentType": "Text", "content": text}, "toRecipients": empfaenger})
        else:
            # POST /messages legt die Nachricht im Entwürfe-Ordner an. Ein Sende-Aufruf existiert nicht.
            entwurf = self._graph("POST", f"{basis}/messages", json={
                "subject": betreff, "body": {"contentType": "Text", "content": text}, "toRecipients": empfaenger})
        return Entwurf(id=entwurf["id"], postfach=postfach, an=an, betreff=betreff, text=text, antwort_auf=antwort_auf)
