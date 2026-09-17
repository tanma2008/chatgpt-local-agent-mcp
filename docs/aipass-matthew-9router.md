# 9Router Integration Architecture: AiPASS Bridge & Matthew Bridge

## System Overview
This document specifies the local API setup, firewall rules, and provider configuration for integrating **AiPASS Bridge** and **Matthew Bridge** as OpenAI-compatible providers into **9Router** running on R740 (`10.4.24.8`).

---

## 1. Local Bridge Configurations (Host: i5-14600k / 10.4.24.227)

### AiPASS Bridge
- **Port**: `8787` (`AIPASS_PORT=8787`)
- **Host Binding**: `0.0.0.0` (`AIPASS_HOST=0.0.0.0`)
- **Allowed Hosts**: `AIPASS_ALLOWED_HOSTS=10.4.24.227,10.4.24.8,localhost,127.0.0.1`
- **Base URL**: `http://10.4.24.227:8787/v1`
- **Capability**: Text (Chat & Reasoning), Image, Video, Music, Deep Research (36 models total)
- **Status Endpoint**: `GET http://10.4.24.227:8787/status`
- **Models Endpoint**: `GET http://10.4.24.227:8787/v1/models`

### Matthew Bridge
- **Port**: `8788` (`MATTHEW_PORT=8788`)
- **Host Binding**: `0.0.0.0` (`MATTHEW_HOST=0.0.0.0`)
- **Base URL**: `http://10.4.24.227:8788/v1`
- **Capability**: Text & Reasoning Chat (8 models: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.2, gpt-5-mini, gpt-4.1, gpt-4o, gpt-4o-mini)
- **Models Endpoint**: `GET http://10.4.24.227:8788/v1/models`

---

## 2. Windows Firewall Rule (Security Hardening)
- **Rule Name**: `Allow-AiPASS-Matthew-R740-Only`
- **Ports**: TCP `8787, 8788`
- **RemoteAddress**: `10.4.24.8` (R740), `10.4.24.227` (i5 Localhost), `127.0.0.1`
- **Access Level**: Restricted strictly to R740 and local machine. Public / Internet access is blocked.

---

## 3. 9Router Provider Registrations (R740 - 10.4.24.8:20128)

### AiPASS Provider Definition
- **Provider Type**: OpenAI-Compatible (`custom-openai` / `openai`)
- **Name**: `aipass`
- **Base URL**: `http://10.4.24.227:8787/v1`
- **API Key**: `sk-dummy` (or local placeholder)

### Matthew Provider Definition
- **Provider Type**: OpenAI-Compatible (`custom-openai` / `openai`)
- **Name**: `matthew`
- **Base URL**: `http://10.4.24.227:8788/v1`
- **API Key**: `sk-dummy` (or local placeholder)

---

## 4. Verification & Health Checks
- R740 -> `http://10.4.24.227:8787/status` -> HTTP 200 OK (`extensions: 1`)
- R740 -> `http://10.4.24.227:8788/v1/models` -> HTTP 200 OK (`8 models returned`)
- Chat completions verified via SSE Streaming and Non-Streaming paths.
