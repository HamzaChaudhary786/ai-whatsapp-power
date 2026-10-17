import urllib.request
import urllib.parse
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def request_json(url, data=None, method="GET", headers=None):
    hdrs = headers or {}
    if data is not None and not isinstance(data, (bytes, bytearray)):
        data = json.dumps(data).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def test_image_upload_and_serving():
    print("\n--- TEST 1: PRODUCT IMAGE UPLOAD & ACCESS ---")
    boundary = "----WebKitFormBoundary" + uuid.uuid4().hex[:16]
    part1 = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="test_dress.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8")
    part2 = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\xff\xd9"
    part3 = f"\r\n--{boundary}--\r\n".encode("utf-8")
    body_bytes = part1 + part2 + part3

    req = urllib.request.Request(
        f"{BASE_URL}/products/upload-images",
        data=body_bytes,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print("Upload Response:", res)
        assert len(res.get("urls", [])) > 0, "No image URLs returned"
        img_url = res["urls"][0]

    # Check that static file is served by FastAPI
    fetch_req = urllib.request.Request(f"http://127.0.0.1:8000{img_url}")
    with urllib.request.urlopen(fetch_req) as resp:
        print("Image GET Status:", resp.status, "Content-Type:", resp.headers.get("Content-Type"))
        assert resp.status == 200, "Image fetch failed"

    print("[PASS] Product image upload and direct static serving SUCCESSFUL!")
    return img_url

def test_chat_handoff_and_sync():
    print("\n--- TEST 2: STOREFRONT CHAT HANDOFF & REAL-TIME SYNC ---")
    test_phone = "+923009988776"

    # Step A: Customer starts chat
    status, start_chat = request_json(
        f"{BASE_URL}/ai/stylist-chat",
        data={"message": "I want to talk to an agent please", "phone": test_phone},
        method="POST"
    )
    conv_id = start_chat["conversation_id"]
    print(f"Chat Started -> Conv ID: {conv_id}, Human Needed: {start_chat.get('human_needed')}")
    assert conv_id is not None

    # Step B: Staff assigns chat to themselves (get an existing user ID first)
    status, users = request_json(f"{BASE_URL}/users/")
    assert len(users) > 0, "No staff users found"
    staff_user_id = users[0]["id"]
    staff_name = users[0].get("name") or users[0].get("email")

    status, assign_res = request_json(
        f"{BASE_URL}/conversations/{conv_id}/assign",
        data={"user_id": staff_user_id},
        method="PATCH"
    )
    print(f"Staff Assigned -> Assigned User: {assign_res.get('assigned_user_id')}, Status: {assign_res.get('status')}")
    assert assign_res.get("assigned_user_id") == staff_user_id

    # Step C: Staff sends reply message from Live Inbox
    staff_msg = "Hello! I am your senior stylist. I am ready to guide you."
    status, send_res = request_json(
        f"{BASE_URL}/conversations/{conv_id}/messages",
        data={"text": staff_msg},
        method="POST"
    )
    print(f"Staff Sent Message -> Msg ID: {send_res.get('id')}")

    # Step D: Customer storefront syncs
    encoded_phone = urllib.parse.quote(test_phone)
    status, sync_res = request_json(f"{BASE_URL}/ai/stylist-chat/sync?phone={encoded_phone}")
    print(f"Storefront Sync -> is_assigned_to_staff: {sync_res.get('is_assigned_to_staff')}, staff_name: {sync_res.get('staff_name')}")
    assert sync_res.get("is_assigned_to_staff") is True
    assert sync_res.get("staff_name") is not None

    staff_messages = [m for m in sync_res.get("messages", []) if m.get("sender") == "staff"]
    print(f"Staff Messages in Customer Sync: {len(staff_messages)}")
    assert len(staff_messages) > 0, "Staff message was not synced to storefront!"
    assert any(staff_msg in m.get("text", "") for m in staff_messages)
    print("[PASS] Staff reply message successfully synced to Customer Storefront!")

    # Step E: Customer sends another message while assigned to staff
    status, follow_up = request_json(
        f"{BASE_URL}/ai/stylist-chat",
        data={"message": "Can you show me silk dresses?", "phone": test_phone},
        method="POST"
    )
    print(f"Customer Follow-up -> Active Model: {follow_up.get('active_model')}, Is Assigned: {follow_up.get('is_assigned_to_staff')}")
    assert follow_up.get("is_assigned_to_staff") is True
    assert follow_up.get("active_model") == "human-staff-agent"
    print("[PASS] AI did not hijack conversation; message routed directly to assigned staff!")

    # Step F: Customer switches back to AI
    status, switch_res = request_json(
        f"{BASE_URL}/ai/stylist-chat/switch-to-ai",
        data={"phone": test_phone},
        method="POST"
    )
    print(f"Switch back to AI -> Status: {switch_res.get('status')}")
    assert switch_res.get("status") == "success"

    # Step G: Verify sync shows not assigned to staff
    status, sync_after = request_json(f"{BASE_URL}/ai/stylist-chat/sync?phone={encoded_phone}")
    assert sync_after.get("is_assigned_to_staff") is False
    print("[PASS] Reassignment back to AI verified!")

if __name__ == "__main__":
    test_image_upload_and_serving()
    test_chat_handoff_and_sync()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
