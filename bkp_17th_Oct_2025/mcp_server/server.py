""" Azure AI Agent Service MCP Server """

import os
import time
from pathlib import Path
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from fastapi import Response
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential, ClientSecretCredential


import logging
import threading


# Load environment variables from the mcp-server directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
#load_dotenv()  # Load from current directory as fallback

mcp = FastMCP(
    name="Encora AIVA MCP Server",
    instructions="This MCP server integrates with Azure AI Agent Service to handle Encora AIVA agentic workflows."
)

PROJECT_ENDPOINT_STRING = os.getenv("PROJECT_ENDPOINT_STRING", "")

ACTIVE_STATUSES = {"queued", "in_progress", "requires_action"}
TERMINAL_FAILURE_STATUSES = {"failed"}
DEFAULT_POLL_INTERVAL = 1.0  # seconds
DEFAULT_TIMEOUT = float(os.getenv("AGENT_RUN_TIMEOUT", "180"))  # seconds; configurable via env


def _invoke_agent(
    agent_env_var: str,
    prompt: str,
    *,
    friendly_name: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    poll_interval: float = DEFAULT_POLL_INTERVAL,
) -> str:
    """Generic Azure Agent runner used by all MCP tool wrappers.

    Args:
        agent_env_var: Environment variable name that stores the agent ID.
        prompt: User-provided prompt/content.
        friendly_name: Human label used in error messages (defaults to env var simplified).
        timeout: Max seconds to wait for a run to reach a terminal state.
        poll_interval: Sleep interval between status polls.

    Returns:
        str: Final text response (may be empty) or a formatted error message.
    """
    agent_id = os.getenv(agent_env_var, "").strip()
    label = friendly_name or agent_env_var.replace("_", " ").title()
    if not PROJECT_ENDPOINT_STRING:
        return "⚠️ Configuration error: PROJECT_ENDPOINT_STRING not set"
    if not agent_id:
        return f"⚠️ Configuration error: {agent_env_var} not set"

    start_time = time.time()

    try:
        # Use ClientSecretCredential if available, otherwise fall back to DefaultAzureCredential
        azure_client_secret = os.getenv("AZURE_CLIENT_SECRET", "").strip()
        azure_tenant_id = os.getenv("AZURE_TENANT_ID", "").strip()
        azure_client_id = os.getenv("AZURE_CLIENT_ID", "").strip()
        
        if azure_client_secret and azure_tenant_id and azure_client_id:
            credential = ClientSecretCredential(
                tenant_id=azure_tenant_id,
                client_id=azure_client_id,
                client_secret=azure_client_secret
            )
        else:
            credential = DefaultAzureCredential()

        ai_client = AIProjectClient(
            endpoint=PROJECT_ENDPOINT_STRING,
            credential=credential,
            subscription_id=os.getenv("AZURE_SUBSCRIPTION_ID"),
            resource_group_name=os.getenv("AZURE_RESOURCE_GROUP_NAME"),
            project_name=os.getenv("AZURE_PROJECT_NAME")
        )
        with ai_client:
            thread = ai_client.agents.threads.create()
            ai_client.agents.messages.create(thread_id=thread.id, role="user", content=prompt)
            run = ai_client.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent_id)

            # Some backends may already return a terminal run from create_and_process
            while getattr(run, "status", None) in ACTIVE_STATUSES:
                if time.time() - start_time > timeout:
                    return f"⚠️ {label} timed out after {int(timeout)}s"
                time.sleep(poll_interval)
                run = ai_client.agents.runs.get(thread_id=run.thread_id, run_id=run.id)

            status = getattr(run, "status", "unknown")
            if status in TERMINAL_FAILURE_STATUSES:
                last_error = getattr(run, "last_error", "unknown error")
                return f"❌ {label} run failed: {last_error}"

            # Fetch latest message
            messages = ai_client.agents.messages.list(thread_id=thread.id, order="desc", limit=1)
            msg = next(iter(messages), None)
            if msg and getattr(msg, "text_messages", None):
                try:
                    return msg.text_messages[-1].text.value  # type: ignore[attr-defined]
                except Exception:
                    return "⚠️ Response parsing error: unexpected message structure"
            return "⚠️ No textual response produced"
    except Exception as e:  # Broad catch to preserve existing contract of returning a string
        return f"⚠️ Error invoking {label}: {e}"  # Do not expose stack for now (could log separately)

@mcp.tool()
def run_code_reviewer_agent(prompt: str) -> str:
    """
    Forward a user's natural language request to the Code Reviewer Agent.

    This tool passes the given code snippet directly to the preconfigured agent. The agent is responsible
    for review the code with the help of provided guidelines and return review comments with refactored code.

    Args:
        prompt (str): user prompt with code snippet

    Returns:
        str: The final response from the Code Reviewer Agent, or an error message if the run fails.
    """   
    return _invoke_agent("CODE_REVIEW_AGENT_ID", prompt, friendly_name="Code Reviewer Agent")

@mcp.tool()
def run_code_planner_agent(prompt: str) -> str:
    """
        Forward a user's natural language request to the Coding Planner Agent.
    
        This agent generates a comprehensive and actionable coding plan based on user stories
        retrieved from Jira and the technical stack provided by the user.
        
        The resulting development plan is designed to be fed to coding agents (such as Claude Code) to
        develop new functionality, enabling higher-quality code generation compared to generic prompts.
    
        Workflow:
        - Extracts the project key from the user's prompt.
        - Uses JiraTool to fetch user stories for the specified project key.
        - Requests the technical stack from the user if not provided.
        - Analyzes each user story (summary, description, acceptance criteria) to identify and expand coding tasks.
        - Considers non-functional requirements such as security, error handling, logging, and scalability.
        - Produces a detailed coding plan in markdown format for each user story.
    
        Error Handling:
        - If the project key is missing or invalid, prompts the user or returns an error.
        - If no user stories are found, returns a corresponding message.
        - If the tech stack is missing, requests it from the user and does not generate a coding plan until provided.
    
        Args:
            prompt (str): User request to generate a coding plan for a specific project.
    
        Returns:
            str: The detailed coding plan in markdown format, or an error message if there is a problem accessing
            the Jira project or required information is missing.
    """   
    return _invoke_agent("CODE_PLANNER_AGENT_ID", prompt, friendly_name="Coding Planner Agent")

@mcp.tool()
def run_test_case_generator_agent(prompt: str) -> str:
    """
    Forwards a user's natural language request to the QA Manual Test Case Generator Agent.
 
    This tool generates comprehensive manual test cases from business requirements and optional system context.
    Your prompt must clearly specify:
      - The business requirements to be tested (required)
      - Any relevant system context (optional)
 
    Response Format:
    The agent returns a Markdown string with the generated test scenario. Each test scenario includes:
        Scenario ID: ID.
        Scenario Name: Concise name.
        Description: A short explanation of the scenario and what is being validated.
        Scope: The exact part of the business requirement being validated.
        Priority: P0 (Critical), P1 (High), P2 (Medium), P3 (Low) based on business impact.
        Expected Result: What the outcome must be for the scenario to pass.
    Args:
        prompt (str): A clear, specific request including business requirements and additional context.
 
     Returns:
        str: The final response from the QA Test Case Generator Agent with the generate test scenarios, or an error message if the run fails.
    """   
    return _invoke_agent("QA_SCENARIO_AGENT_ID", prompt, friendly_name="QA Manual Test Case Generator Agent")

@mcp.tool()
def run_test_case_generator_gherkin_agent(prompt: str) -> str:
    """
    Forwards a user's natural language request to the QA Gherkin Test Case Generator Agent.
 
    This tool generates comprehensive manual test cases from business requirements and optional system context.
    Your prompt must clearly specify:
      - The business requirements to be tested (required)
      - Any relevant system context (optional)
 
    Response Format:
    The agent returns a URL to download a `.feature` file with the generated test cases in Gherkin format.
    Args:
        prompt (str): A clear, specific request including business requirements and additional context.
 
     Returns:
        str: The final response from the QA Gherkin Test Case Generator Agent with the URL to download the .feature file that holds the generated test cases, or an error message if the run fails.
    """   
    return _invoke_agent("QA_GHERKIN_AGENT_ID", prompt, friendly_name="QA Gherkin Test Case Generator Agent")

@mcp.tool()
def run_project_status_reporter_agent(prompt: str) -> str:
    """
    Forwards a user's natural language request to the Project Status Reporter Agent.
 
    This tool generates a comprehensive project status report in HTML format from Jira data.
    Your prompt must clearly specify:
      - The Jira project and sprint to report on (required)
      - Any specific sections or data points to include (optional)
    """   
    return _invoke_agent("PROJECT_STATUS_REPORTER_AGENT_ID", prompt, friendly_name="Project Status Reporter Agent")

@mcp.tool()
def run_test_generation_agent(prompt: str) -> str:
    """
    Forward a user's request to the Test Case generation Agent.

    This tool passes the given prompt directly to the preconfigured 'test script generation' agent.
    The agent task is to create/generate test cases using the given requirements.
    The final response is the test source code.

    Args:
        prompt (str): A natural language request from the user including steps to generate tests:

    Returns:
        str: The Generated test sources links.
    """   
    return _invoke_agent("AGENT_ID", prompt, friendly_name="Test Case Generation Agent")

@mcp.tool()
def run_code_documenter_agent(prompt: str) -> str:
    """
    Forward a user's natural language request to the Code Documenter Agent.

    This tool passes the given code or project request directly to the preconfigured documenter agent. 
    The agent is responsible for generating comprehensive documentation including README files, 
    API documentation, and inline code comments based on provided guidelines and best practices.

    Args:
        prompt (str): user prompt with code snippet, project details, or documentation requirements

    Returns:
        str: The final response from the Code Documenter Agent, or an error message if the run fails.
    """   
    return _invoke_agent("CODE_DOCUMENTER_AGENT_ID", prompt, friendly_name="Code Documenter Agent")

# === Start MCP ===
if __name__ == "__main__":
    mcp.run()