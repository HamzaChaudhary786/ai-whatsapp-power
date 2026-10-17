from typing import Any, Optional
from pydantic import BaseModel


class ApiResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"
    data: Optional[Any] = None


def success_response(data: Any = None, message: str = "Success") -> dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def error_response(message: str = "An error occurred", data: Any = None) -> dict[str, Any]:
    return {"success": False, "message": message, "data": data}
