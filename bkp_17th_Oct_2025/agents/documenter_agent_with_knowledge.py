import os
from dotenv import load_dotenv
from azure.ai.agents.models import FilePurpose, FileSearchTool, ToolResources, FileSearchToolResource
from datetime import datetime
from types import SimpleNamespace
from .utils import get_project_client
from .instruction import CODE_DOCUMENTER_INSTRUCTIONS
from pathlib import Path
from tools.openapi_tools import get_all_tools


load_dotenv()
script_dir = Path(__file__).parent
# Load environment variables
model = os.getenv("MODEL_DEPLOYMENT_NAME", "")
file_path = script_dir.parent/"knowledge"/"documentation_guidelines.json"  # Path to your knowledge file
file_path = str(file_path)
project_client = get_project_client()
openapi_tools = get_all_tools()
# Create project client
project_client = get_project_client()

with project_client:
    # Upload the file
    file = project_client.agents.files.upload_and_poll(
        file_path=file_path,
        purpose=FilePurpose.AGENTS
    )
    print(f"Uploaded file, file ID: {file.id}")

    # Create a vector store with the uploaded file
    vector_store = project_client.agents.vector_stores.create_and_poll(
        file_ids=[file.id],
        #name="example_vector_store"
        name="documentation_vector_store"
    )
    print(f"Created vector store, vector store ID: {vector_store.id}")

    # Create file search tool
    file_search = FileSearchTool(vector_store_ids=[vector_store.id])

    today = datetime.now().strftime("%d/%m/%Y")

    # Construct tool_resources with explicit FileSearchToolResource
    tool_resources = ToolResources(
        file_search=FileSearchToolResource(vector_store_ids=[vector_store.id]),
        code_interpreter=None
    )

    # Create agent
    agent = project_client.agents.create_agent(
        model=model,
        name="code-documenter-agent",
        # Use safe token replacement to avoid KeyError from JSON braces in the prompt
        instructions=CODE_DOCUMENTER_INSTRUCTIONS.replace("{today}", today),
        tools=[
            *openapi_tools,
            *file_search.definitions
        ],
        tool_resources=tool_resources,
        description="An expert-level code documentation and security analysis agent that provides comprehensive technical assessments, security evaluations, and professional-grade documentation following industry standards and best practices."
    )
    print(f"Created agent with Knowledge base, ID: {agent.id}")