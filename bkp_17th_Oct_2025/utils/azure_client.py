"""
Azure Authentication and Client Management for AIVA MCP Server

This module provides centralized Azure authentication and client management
for all Azure services used in the AIVA MCP Server with advanced caching.

Version: 1.1.0
Date: 05/09/2025
"""

import os
import time
import logging
from typing import Optional
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

logger = logging.getLogger(__name__)

# Import caching system
try:
    import sys
    # Add current directory (utils) to path for caching import
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    from caching import azure_cache
    CACHING_AVAILABLE = True
    logger.info("Azure caching system is available. To use it make the 'USE_AZURE_TOKEN_CACHE' flag = True")
except ImportError as e:
    CACHING_AVAILABLE = False
    logger.warning(f"Azure caching system not available: {e}, falling back to direct access")

class AzureCredentialManager:
    """
    Manages Azure authentication using DefaultAzureCredential with caching support.
    """
    def __init__(self):
        self._credential = None
    
    def get_credential(self):
        """
        Get the Azure credential instance with caching support.
        
        Returns:
            DefaultAzureCredential: Azure credential for authentication
        """
        if CACHING_AVAILABLE:
            return azure_cache.get_or_create_credential()
        else:
            # Fallback to non-cached version
            if self._credential is None:
                self._credential = DefaultAzureCredential()
            return self._credential
    
    def get_token(self, *scopes, **kwargs):
        """
        Get an Azure access token for the specified scopes with caching.
        
        Args:
            *scopes: The scopes to request access for
            **kwargs: Additional keyword arguments
            
        Returns:
            Azure access token
            
        Raises:
            Exception: If token acquisition fails
        """
        try:
            if CACHING_AVAILABLE:
                # Try to get cached token first
                cached_token = azure_cache.get_or_fetch_token(*scopes)
                if cached_token:
                    return cached_token
            
            # Fallback to direct credential access
            credential = self.get_credential()
            token = credential.get_token(*scopes)
            
            # Cache the token if caching is available
            if CACHING_AVAILABLE and token:
                azure_cache.cache_token(token, *scopes)
            
            return token
        except Exception as e:
            logger.error(f"Failed to get token: {e}")
            raise


class AzureAIProjectManager:
    """
    Manages Azure AI Project client connections and operations.
    """
    
    def __init__(self):
        self.credential_manager = AzureCredentialManager()
        self.project_endpoint = os.getenv("PROJECT_ENDPOINT_STRING", "")
        if not self.project_endpoint:
            logger.warning("PROJECT_ENDPOINT_STRING not set in environment")
    
    def get_client(self) -> AIProjectClient:
        """
        Get an Azure AI Project client instance.
        
        Returns:
            AIProjectClient: Configured Azure AI Project client
            
        Raises:
            ValueError: If project endpoint is not configured
        """
        if not self.project_endpoint:
            raise ValueError("PROJECT_ENDPOINT_STRING not configured")
        
        # Get required Azure parameters from environment
        subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")
        resource_group_name = os.getenv("AZURE_RESOURCE_GROUP_NAME")
        project_name = os.getenv("AZURE_PROJECT_NAME")
        
        if not subscription_id or not resource_group_name or not project_name:
            raise ValueError("Missing required Azure parameters: AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP_NAME, AZURE_PROJECT_NAME")
        
        return AIProjectClient(
            endpoint=self.project_endpoint,
            credential=self.credential_manager.get_credential(),
            subscription_id=subscription_id,
            resource_group_name=resource_group_name,
            project_name=project_name
        )
    
    def run_agent(self, prompt: str, agent_id: Optional[str] = None) -> str:
        """
        Execute an Azure AI Agent with the given prompt.
        
        Args:
            prompt (str): The input prompt for the agent
            agent_id (str, optional): Specific agent ID to use. If not provided,
                                     uses AGENT_ID from environment
                                     
        Returns:
            str: The agent's response or error message
        """
        try:
            if not self.project_endpoint:
                return "ERROR: PROJECT_ENDPOINT_STRING not configured"
            
            target_agent_id = agent_id or os.getenv("AGENT_ID", "")
            if not target_agent_id:
                return "ERROR: No agent ID provided and AGENT_ID not set in environment"
            
            ai_client = self.get_client()

            with ai_client:
                # Create thread and message
                thread = ai_client.agents.threads.create()
                ai_client.agents.messages.create(
                    thread_id=thread.id, 
                    role="user", 
                    content=prompt
                )
                
                # Start the run
                run = ai_client.agents.runs.create_and_process(
                    thread_id=thread.id, 
                    agent_id=target_agent_id
                )

                # Wait for completion
                while run.status in ["queued", "in_progress", "requires_action"]:
                    time.sleep(1)
                    run = ai_client.agents.runs.get(
                        thread_id=run.thread_id, 
                        run_id=run.id
                    )

                if run.status == "failed":
                    error_msg = f"ERROR: Agent run failed: {run.last_error}"
                    logger.error(error_msg)
                    return error_msg
                else:
                    # Get the latest message
                    messages = ai_client.agents.messages.list(
                        thread_id=thread.id, 
                        order="desc", 
                        limit=1
                    )
                    msg = next(iter(messages), None)
                    if msg and msg.text_messages:
                        return msg.text_messages[-1].text.value
                    else:
                        logger.warning("No response message found")
                        return "WARNING: Agent completed but no response message found"

        except Exception as e:
            error_msg = f"WARNING: Error calling Azure AI Agent: {str(e)}"
            logger.error(error_msg)
            return error_msg
