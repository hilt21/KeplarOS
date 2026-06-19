# KEPLAR Documentation

## Phase 2 Baseline

Phase 1 is complete as the **Web-first Board demo slice**. Phase 2 is **Web Collaboration Beta** and starts from the completed Web-first baseline described in [Phase 1 Scope](specs/phase1_scope.md). Future/Production items such as Tauri, Rust Axum, real MCP/ACP/A2A writes, Kubernetes, enterprise SSO, OpenTelemetry, and production HA remain deferred.

## Development Guide
**Phase 1: Early Business & Requirements (Do First)**  

1. Swimlane Flow  
2. PRD (Product Requirements Document)  
3. Use Case Diagram  

**Phase 2: Global Foundational Specifications (Unified Standards, Set in Advance)**  

4. Global Unified Specifications  
5. Non-Functional Requirements Specifications (Performance, Security, Availability, Concurrency, Disaster Recovery, etc.)  

**Phase 3: System Architecture & State Models**  

6. [System Architecture Diagram](architecture/system_architecture.md) (Overall Layering, Modules, Dependencies)  
7. [State Transition Diagram](architecture/state_transition.md) (State Machine for Core Business Objects)  
8. [Data Flow Diagram](architecture/data_flow.md) (Data Movement Between Components)  

**Phase 4: Database Related**  

8. ER Diagram (Entity-Relationship Diagram)  
9. Database Design (Table Structures, Fields, Indexes, Dictionaries, Refined from ER Diagram)  

**Phase 5: Interfaces & Final Deployment**  

10. Interface Specifications (Frontend‑Backend / Microservices Interface Definitions)  
11. Deployment Topology Diagram (Produced Last: Servers, Clusters, Network, Service Deployment Structure)

## Architecture

- [System Architecture](architecture/system_architecture.md) — Overall Layering, Modules, Dependencies
- [State Transition](architecture/state_transition.md) — Card State Machine (Backlog/Todo/Dev/Review/Done/Blocked)
- [Goal Space State](architecture/goal_space_state.md) — Goal Space Lifecycle (Draft/Active/Completed)
- [Human Confirm State](architecture/human_confirm_state.md) — Human Confirmation Flow (Pending/Approved/Rejected/Cancelled)
- [Data Flow](architecture/data_flow.md) — Data Movement Between Components
- [Use Case Diagram](architecture/use_case.md) — Actor and Use Case Relationships
- [User Stories](architecture/user_stories.md) — Human Actor Stories (Initiator/Chain User)
- [AI Interaction Flows](architecture/interaction_flows.md) — AI Role Interaction Derivations
- [Test Matrix](architecture/test_matrix.md) — Coverage Matrix, Scenarios, Acceptance Criteria

## Specification

- [Non-Functional Requirements](specs/non_functional_requirements.md) — Performance, Scalability, Security, Observability
- [Phase 1 Scope](specs/phase1_scope.md) — Completed Web-first Board demo baseline and Phase 2 Web Collaboration Beta starting point
- [Authorization Matrix](specs/authorization_matrix.md) — Role, ownership, confirmation gate, and audit requirements
- [AI Agent Contracts](specs/ai_agent_contracts.md) — Executor contract, role outputs, validation, retry, blocked routing
- [Realtime Events](specs/realtime_events.md) — SSE event envelope, replay cursor, reconnect, and multi-tab behavior
- [Database Design](specs/database_design.md) — ER Diagram, Table Structures, Migrations
- [Interface Specifications](specs/interface_spec.md) — REST API Endpoints, SSE Events, Error Codes

## Fitness Documentation
