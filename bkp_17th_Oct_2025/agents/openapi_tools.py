import jsonref
from typing import List
from azure.ai.agents.models import OpenApiTool, OpenApiAnonymousAuthDetails

def load_openapi_tool(schema_path: str, tool_name: str, description: str) -> OpenApiTool:
    with open(schema_path, "r") as f:
        openapi_spec = jsonref.loads(f.read())
    
    auth = OpenApiAnonymousAuthDetails()
    return OpenApiTool(
        name=tool_name,
        spec=openapi_spec,
        description=description,
        auth=auth
    )

def get_all_tools() -> List:
    tools = []

    tools_metadata = [        
        {
            "name": "code_documenter_tool",
            "description": "code_documenter_tool_description",
            "schema_path": "tools/OpenAPI_schemas/code_documenter.json",                           
        }
    ]

    for tool in tools_metadata:
        try:
            new_tool = load_openapi_tool(
                schema_path=tool["schema_path"],
                tool_name=tool["name"],
                description=tool["description"],
            )
            tools.extend(new_tool.definitions)
        except Exception as e:
            print(f"Error loading OpenAPI tool: {e}")

    return tools
