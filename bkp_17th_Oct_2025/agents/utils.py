import os
import subprocess
from azure.identity import DefaultAzureCredential, AzureCliCredential, ChainedTokenCredential
from azure.core.credentials import AccessToken
from azure.ai.projects import AIProjectClient
from dotenv import load_dotenv
import datetime

load_dotenv()

class StaticTokenCredential:
    """Custom credential that uses a static token"""
    def __init__(self, token):
        self.token = token
    
    def get_token(self, *scopes, **kwargs):
        # Return token with a future expiry (1 hour from now)
        expires_on = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
        return AccessToken(self.token, int(expires_on.timestamp()))

def get_azure_cli_token():
    """Get token directly from Azure CLI"""
    try:
        # Original hardcoded path (commented out - may be needed in some environments)
        # result = subprocess.run([
        #     "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd",
        #     "account", "get-access-token",
        #     "--resource", "https://ai.azure.com",
        #     "--query", "accessToken",
        #     "--output", "tsv"
        # ], capture_output=True, text=True, check=True)
        
        # Updated approach: Use 'az' directly with shell=True (works better on Windows)
        result = subprocess.run([
            "az", "account", "get-access-token",
            "--resource", "https://ai.azure.com",
            "--query", "accessToken",
            "--output", "tsv"
        ], capture_output=True, text=True, check=True, shell=True)
        return result.stdout.strip()
    except Exception as e:
        print(f"Failed to get token from Azure CLI: {e}")
        return None

def get_project_client():
    conn_str = os.getenv("PROJECT_ENDPOINT_STRING", "")
    
    # Try to get token from Azure CLI
    token = get_azure_cli_token()
    if token:
        print("Using token from Azure CLI")
        credential = StaticTokenCredential(token)
    else:
        print("Using default credential chain")
        credential = DefaultAzureCredential()
    
    return AIProjectClient(
        endpoint=conn_str,
        credential=credential
    )