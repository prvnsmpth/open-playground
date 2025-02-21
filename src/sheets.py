from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = "gmail-bot-448408-6b6ec76b9622.json"
ADMIN_EMAIL = "praveen@casepro.club"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.readonly",
]

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=SCOPES
)
delegated_creds = creds.with_subject(ADMIN_EMAIL)

# SHEET_ID = '185KK9sBs0oPDp7NrMIXIpY_kR1CHvzdxVPmu8TJRB_8'
SHEET_ID = '1lrpRn1gxp_oZqy1NMEwC0G8Y84wS6ZtQldQDoENOflI'

service = build("sheets", "v4", credentials=delegated_creds)
sheet = service.spreadsheets()
