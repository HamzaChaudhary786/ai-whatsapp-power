import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, status

class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter to prevent brute-force attacks and abuse."""

    def __init__(self):
        # Maps key (e.g. "login:127.0.0.1") to list of timestamps
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        # Check standard reverse proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "127.0.0.1"

    def check(self, request: Request, action_name: str, max_requests: int, window_seconds: int) -> None:
        ip = self._get_client_ip(request)
        key = f"{action_name}:{ip}"
        now = time.time()
        window_start = now - window_seconds

        # Prune outdated timestamps
        self._requests[key] = [t for t in self._requests[key] if t > window_start]

        if len(self._requests[key]) >= max_requests:
            retry_after = int(window_seconds - (now - self._requests[key][0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests for {action_name}. Please try again in {max(1, retry_after)} seconds.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self._requests[key].append(now)


rate_limiter = InMemoryRateLimiter()
