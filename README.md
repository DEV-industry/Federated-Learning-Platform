# Federated Learning Platform

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C7202C?style=for-the-badge&logo=minio&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)

Zaawansowana platforma do rozproszonego uczenia maszynowego (Federated Learning) zbudowana z myślą o maksymalnej prywatności i bezpieczeństwie danych (Privacy-Preserving ML). System pozwala na trenowanie modeli sztucznej inteligencji na urządzeniach brzegowych bez przesyłania surowych danych do centralnego serwera.

## Główne funkcje (Security-First)

* **Szyfrowanie Homomorficzne (HE):** Operacje matematyczne (agregacja wag) wykonywane bezpośrednio na zaszyfrowanych danych z użyciem biblioteki TenSEAL.

HE to metoda szyfrowania, która pozwala serwerowi wykonywać sumowanie i uśrednianie bez odszyfrowywania wag po stronie serwera.
* **Lokalna Prywatność Różnicowa (LDP):** Ochrona przed wyciekiem cech poprzez automatyczne przycinanie gradientów (clipping) i dodawanie szumu Gaussa.
* **Dynamiczne sterowanie hiperparametrami:** Agregator adaptacyjnie dostraja `FedProx μ` oraz `DP noise multiplier` na podstawie metryk kolejnych rund i rozsyła aktualne wartości do klientów przez gRPC.
* **Odporność Bizantyjska (Bulyan):** Zaawansowany algorytm agregacji odporny na zatrute dane i złośliwe węzły.
* **Izolacja Sprzętowa (TEE):** Agregator uruchamiany w bezpiecznej enklawie procesora przy użyciu Intel SGX i Gramine.

## Stack Technologiczny

### Backend & Core
![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C7202C?style=for-the-badge&logo=minio&logoColor=white)

* **Aggregator:** Java 17, Spring Boot, Spring Security (JWT)
* **Komunikacja:** gRPC (binarna wymiana wag), WebSockets (real-time events)
* **Infrastruktura:** RabbitMQ (asynchroniczne kolejkowanie), PostgreSQL (metadane), MinIO (magazyn modeli S3)

### Client & ML
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)

* **Node Client:** Python, PyTorch, Torchvision
* **HE Sidecar:** Python, FastAPI, TenSEAL (operacje kryptograficzne)

### Frontend & DevOps
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)

* **WebApp:** Next.js 14 (App Router), TypeScript, Tailwind CSS
* **Deployment:** Docker, Docker Compose, pełne manifesty Kubernetes (K8s)
* **Monitoring:** Prometheus, Grafana (dedykowane dashboardy)

---

## Architektura Systemu (C4 - Poziom Kontenerów)

~~~mermaid
graph LR
    subgraph Klienci
        UI([Przeglądarka / Admin])
        NODE([Node Client 1..N])
    end

    subgraph "Federated Learning Platform (K8s)"
        FE[Frontend - Next.js]
        AGG[Aggregator Service - Spring Boot]
        HE[HE Sidecar - Python]
        
        DB[(PostgreSQL)]
        RMQ[(RabbitMQ)]
        MINIO[(MinIO)]
    end

    UI -->|HTTP| FE
    FE -->|REST / WebSockets| AGG
    NODE -->|gRPC / REST| AGG
    AGG <-->|REST| HE
    
    AGG -->|JDBC| DB
    AGG -->|AMQP| RMQ
    AGG -->|S3 API| MINIO
~~~

## Przepływ Danych i Trenowania (Cykl Rundy)

~~~mermaid
graph TD
    NC[Node Client - Python] -->|1. gRPC: Wysyłka wag + LDP| AGG[Aggregator API - Java]
    AGG -->|2. Kolejkowanie wiadomości| RMQ[(RabbitMQ)]
    RMQ -->|3. Konsumpcja asynchroniczna| CONS[Aggregation Consumer]
    CONS <-->|4. REST: Dodawanie szyfrogramów| HE[HE Sidecar - FastAPI]
    CONS -->|5. Zapis metadanych rundy| DB[(PostgreSQL)]
    CONS -->|6. Zapis pliku modelu globalnego| MINIO[(MinIO Storage)]
    CONS -->|7. Powiadomienie o nowej rundzie| WS[WebSockets]
~~~

## Szybki Start

### Opcja 1: Uruchomienie lokalne (Docker Compose)
Najszybszy sposób na postawienie całego środowiska.

~~~bash
# Klonowanie repozytorium
git clone https://github.com/DEV-industry/federated-learning-platform.git
cd federated-learning-platform

# Skopiowanie konfiguracji środowiskowej
cp .env.example .env

# Uruchomienie wszystkich serwisów
docker-compose up --build
~~~

**Dostępne serwisy i porty:**
* **Frontend (Aplikacja):** `http://localhost:3000`
* **Aggregator (REST API over HTTPS):** `https://localhost:8443`
* **Aggregator (gRPC over TLS):** `localhost:9443`
* **Grafana (Monitoring):** `http://localhost:3001`
* **RabbitMQ (Panel UI):** `http://localhost:15672`
* **MinIO (Konsola S3):** `http://localhost:9001`

Przed uruchomieniem środowiska wygeneruj certyfikaty TLS zgodnie z instrukcją w `certs/README.md`.

*(Uwaga: dokładne porty mogą się różnić w zależności od konfiguracji w pliku `docker-compose.yml`)*

### Konfiguracja HE (wspólny kontekst)

W trybie `HE_ENABLED=true` wszystkie węzły muszą używać tego samego kontekstu TenSEAL (wspólny klucz publiczny), inaczej agregacja szyfrogramów jest odrzucana.

1. Wygeneruj wspólny kontekst (jednorazowo):

~~~bash
python node_client/generate_shared_he_context.py
~~~

2. W tym repozytorium shared context jest budowany do obrazu `node_client`, więc standardowe `docker compose up --build` oraz obraz używany w K8s dostają ten sam kontekst automatycznie.

3. Jeśli chcesz nadpisać ten plik, ustaw w każdym `node_client` jedną z opcji:

~~~bash
HE_SHARED_CONTEXT_B64=<zawartosc_shared_he_context_private.b64>
# lub
HE_SHARED_CONTEXT_FILE=/run/secrets/shared_he_context_private.b64
~~~

4. Agregator automatycznie wymusza zgodność `he_context_public` dla wszystkich zgłoszeń i odrzuca niespójne payloady.

Krótki przepływ HE w rundzie FL:

~~~mermaid
sequenceDiagram
    participant N as Node Client
    participant A as Aggregator
    participant H as HE Sidecar

    N->>N: Trening lokalny + szyfrowanie wag (shared context)
    N->>A: SubmitWeights(encrypted_weights, he_context_public)
    A->>A: Walidacja zgodności he_context_public
    A->>H: POST /aggregate(pub_ctx, encrypted_blobs[])
    H->>H: Suma i srednia na szyfrogramach (bez deszyfrowania)
    H-->>A: aggregated_blob
    A-->>N: Global model (ciphertext) dla kolejnej rundy
~~~

### Opcja 2: Środowisko Produkcyjne (Kubernetes)
Projekt zawiera komplet manifestów do wdrożenia na klaster K8s.

~~~bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/
~~~

## Monitoring i CI/CD
System eksportuje kluczowe metryki do systemu `Prometheus`. Wizualizacja odbywa się przez gotowe dashboardy w `Grafanie`, pozwalając na śledzenie:
- Czasu trwania poszczególnych rund FL.
- Spadku funkcji straty (Loss) i wzrostu dokładności (Accuracy) w czasie rzeczywistym.
- Stanów poszczególnych węzłów.
  
Testy automatyczne i integracyjne są uruchamiane przez `GitHub Actions` przy każdym nowym commicie.
