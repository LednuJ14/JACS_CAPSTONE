# Program Workflow Diagram

## System Overview
This document outlines the workflow diagrams for the JACS Property Management Platform, separated by user roles: Property Manager, Tenants, and Staff (Optional).

---

## 1. Property Manager Workflow

```mermaid
flowchart TD
    Start[Property Manager Login] --> Dashboard[View Dashboard]
    
    Dashboard --> ChatFlow[Chat Management]
    Dashboard --> RequestFlow[Maintenance Requests]
    Dashboard --> PropertyFlow[Property Management]
    Dashboard --> TenantFlow[Tenant Management]
    Dashboard --> StaffFlow[Staff Management]
    Dashboard --> Analytics[Analytics & Reports]
    
    %% Chat Management Flow
    ChatFlow --> ViewChats[View All Tenant Chats]
    ViewChats --> SelectChat[Select Chat]
    SelectChat --> ViewMessages[View Messages]
    ViewMessages --> SendReply[Send Reply]
    SendReply --> MarkRead[Mark as Read]
    MarkRead --> ViewChats
    
    %% Maintenance Request Flow
    RequestFlow --> ViewRequests[View All Requests]
    ViewRequests --> FilterRequests[Filter by Status/Category]
    FilterRequests --> SelectRequest[Select Request]
    SelectRequest --> ViewDetails[View Request Details]
    ViewDetails --> UpdateStatus{Update Status?}
    UpdateStatus -->|Yes| ChangeStatus[Change Status:<br/>Pending → In Progress<br/>In Progress → Completed]
    UpdateStatus -->|No| AssignStaff{Assign Staff?}
    ChangeStatus --> NotifyTenant[Notify Tenant]
    AssignStaff -->|Yes| SelectStaff[Select Staff Member]
    SelectStaff --> Assign[Assign to Staff]
    Assign --> NotifyStaff[Notify Staff]
    NotifyStaff --> ViewRequests
    NotifyTenant --> ViewRequests
    
    %% Property Management Flow
    PropertyFlow --> ViewProperties[View Properties]
    ViewProperties --> AddProperty[Add New Property]
    ViewProperties --> EditProperty[Edit Property]
    ViewProperties --> ManageUnits[Manage Units]
    
    %% Tenant Management Flow
    TenantFlow --> ViewTenants[View All Tenants]
    ViewTenants --> AddTenant[Add New Tenant]
    ViewTenants --> EditTenant[Edit Tenant Info]
    ViewTenants --> ViewLeases[View Lease Agreements]
    
    %% Staff Management Flow
    StaffFlow --> ViewStaff[View All Staff]
    ViewStaff --> AddStaff[Add New Staff]
    ViewStaff --> EditStaff[Edit Staff Info]
    ViewStaff --> AssignRole[Assign Staff Role]
    
    %% Analytics Flow
    Analytics --> ViewStats[View Statistics]
    ViewStats --> FinancialReport[Financial Reports]
    ViewStats --> OccupancyReport[Occupancy Reports]
    ViewStats --> RequestReport[Request Reports]
    
    style Start fill:#4A90E2
    style Dashboard fill:#7B68EE
    style ChatFlow fill:#50C878
    style RequestFlow fill:#FF6B6B
    style PropertyFlow fill:#FFA500
    style TenantFlow fill:#9B59B6
    style StaffFlow fill:#3498DB
    style Analytics fill:#E74C3C
```

---

## 2. Tenant Workflow

```mermaid
flowchart TD
    Start[Tenant Login] --> Dashboard[View Dashboard]
    
    Dashboard --> ChatFlow[Chat with Manager]
    Dashboard --> RequestFlow[Maintenance Requests]
    Dashboard --> Announcements[View Announcements]
    Dashboard --> Documents[View Documents]
    Dashboard --> Profile[Manage Profile]
    
    %% Chat Management Flow
    ChatFlow --> ViewChats[View Chats with Manager]
    ViewChats --> CreateChat{New Chat?}
    CreateChat -->|Yes| NewChat[Create New Chat]
    CreateChat -->|No| SelectChat[Select Existing Chat]
    NewChat --> ViewMessages[View Messages]
    SelectChat --> ViewMessages
    ViewMessages --> SendMessage[Send Message]
    SendMessage --> ViewChats
    
    %% Maintenance Request Flow
    RequestFlow --> ViewMyRequests[View My Requests]
    ViewMyRequests --> CreateRequest{Create Request?}
    CreateRequest -->|Yes| FillForm[Fill Request Form:<br/>- Title<br/>- Description<br/>- Category<br/>- Priority<br/>- Images]
    FillForm --> SubmitRequest[Submit Request]
    SubmitRequest --> RequestCreated[Request Created]
    RequestCreated --> ViewMyRequests
    CreateRequest -->|No| SelectRequest[Select Request]
    SelectRequest --> ViewRequestDetails[View Request Details]
    ViewRequestDetails --> UpdateRequest{Update Request?}
    UpdateRequest -->|Yes| CheckStatus{Status = Pending?}
    CheckStatus -->|Yes| EditRequest[Edit Title/Description/Priority]
    CheckStatus -->|No| CannotEdit[Can't Edit - Request in Progress]
    EditRequest --> SaveChanges[Save Changes]
    SaveChanges --> ViewMyRequests
    CannotEdit --> ViewMyRequests
    UpdateRequest -->|No| ProvideFeedback{Provide Feedback?}
    ProvideFeedback -->|Yes| CheckCompleted{Status = Completed?}
    CheckCompleted -->|Yes| RateRequest[Rate Request 1-5]
    RateRequest --> AddComments[Add Comments]
    AddComments --> SubmitFeedback[Submit Feedback]
    SubmitFeedback --> ViewMyRequests
    CheckCompleted -->|No| ViewMyRequests
    ProvideFeedback -->|No| ViewMyRequests
    
    %% Announcements Flow
    Announcements --> ViewAnnouncements[View All Announcements]
    ViewAnnouncements --> ReadAnnouncement[Read Announcement]
    
    %% Documents Flow
    Documents --> ViewDocuments[View Available Documents]
    ViewDocuments --> DownloadDoc[Download Document]
    
    %% Profile Flow
    Profile --> ViewProfile[View Profile]
    ViewProfile --> EditProfile[Edit Profile Info]
    EditProfile --> SaveProfile[Save Changes]
    
    style Start fill:#4A90E2
    style Dashboard fill:#7B68EE
    style ChatFlow fill:#50C878
    style RequestFlow fill:#FF6B6B
    style Announcements fill:#FFA500
    style Documents fill:#9B59B6
    style Profile fill:#3498DB
```

---

## 3. Staff Workflow (Optional)

```mermaid
flowchart TD
    Start[Staff Login] --> Dashboard[View Dashboard]
    
    Dashboard --> AssignedTasks[View Assigned Tasks]
    Dashboard --> AssignedRequests[View Assigned Requests]
    Dashboard --> Profile[Manage Profile]
    
    %% Assigned Requests Flow
    AssignedRequests --> ViewMyRequests[View My Assigned Requests]
    ViewMyRequests --> FilterByStatus[Filter by Status]
    FilterByStatus --> SelectRequest[Select Request]
    SelectRequest --> ViewRequestDetails[View Request Details:<br/>- Tenant Info<br/>- Unit Info<br/>- Description<br/>- Priority]
    ViewRequestDetails --> StartWork{Start Work?}
    StartWork -->|Yes| UpdateToInProgress[Update Status to In Progress]
    StartWork -->|No| AddWorkNotes[Add Work Notes]
    UpdateToInProgress --> AddWorkNotes
    AddWorkNotes --> SaveNotes[Save Notes]
    SaveNotes --> CompleteWork{Work Complete?}
    CompleteWork -->|Yes| UpdateToCompleted[Update Status to Completed]
    CompleteWork -->|No| ContinueWork[Continue Working]
    UpdateToCompleted --> AddResolutionNotes[Add Resolution Notes]
    AddResolutionNotes --> NotifyManager[Notify Property Manager]
    NotifyManager --> NotifyTenant[Notify Tenant]
    NotifyTenant --> ViewMyRequests
    ContinueWork --> ViewMyRequests
    
    %% Assigned Tasks Flow
    AssignedTasks --> ViewMyTasks[View My Tasks]
    ViewMyTasks --> FilterTasks[Filter Tasks]
    FilterTasks --> SelectTask[Select Task]
    SelectTask --> ViewTaskDetails[View Task Details]
    ViewTaskDetails --> UpdateTaskStatus[Update Task Status]
    UpdateTaskStatus --> AddTaskNotes[Add Task Notes]
    AddTaskNotes --> CompleteTask[Mark Task Complete]
    CompleteTask --> ViewMyTasks
    
    %% Profile Flow
    Profile --> ViewProfile[View Profile]
    ViewProfile --> EditProfile[Edit Profile Info]
    EditProfile --> SaveProfile[Save Changes]
    
    style Start fill:#4A90E2
    style Dashboard fill:#7B68EE
    style AssignedRequests fill:#FF6B6B
    style AssignedTasks fill:#50C878
    style Profile fill:#3498DB
```

---

## 4. Cross-Role Interaction Flow

```mermaid
sequenceDiagram
    participant T as Tenant
    participant PM as Property Manager
    participant S as Staff (Optional)
    participant SYS as System
    
    Note over T,SYS: Maintenance Request Workflow
    T->>SYS: Create Maintenance Request
    SYS->>PM: Notify New Request
    PM->>SYS: View Request
    PM->>SYS: Assign to Staff
    SYS->>S: Notify Assignment
    S->>SYS: Update Status to In Progress
    SYS->>T: Notify Status Update
    S->>SYS: Add Work Notes
    S->>SYS: Update Status to Completed
    SYS->>PM: Notify Completion
    SYS->>T: Notify Completion
    T->>SYS: Provide Feedback & Rating
    
    Note over T,PM: Chat Workflow
    T->>SYS: Create Chat with Manager
    SYS->>PM: Notify New Chat
    T->>SYS: Send Message
    SYS->>PM: Notify New Message
    PM->>SYS: Send Reply
    SYS->>T: Notify New Message
```

---

## 5. System Features Summary

### Property Manager Features
- ✅ Chat Management (View/Reply to tenant chats)
- ✅ Maintenance Request Management (View/Update/Assign)
- ✅ Property Management (CRUD operations)
- ✅ Tenant Management (View/Add/Edit tenants)
- ✅ Staff Management (View/Add/Edit staff)
- ✅ Analytics & Reports (Financial, Occupancy, Requests)
- ✅ Announcement Management
- ✅ Document Management

### Tenant Features
- ✅ Chat with Property Manager (Create/View/Send messages)
- ✅ Maintenance Request Management (Create/View/Update/Delete pending requests)
- ✅ Request Feedback (Rate and comment on completed requests)
- ✅ View Announcements
- ✅ View Documents
- ✅ Profile Management

### Staff Features (Optional)
- ✅ View Assigned Maintenance Requests
- ✅ Update Request Status
- ✅ Add Work Notes
- ✅ Add Resolution Notes
- ✅ View Assigned Tasks
- ✅ Update Task Status
- ✅ Profile Management

---

## 6. Key Workflow States

### Maintenance Request States
1. **Pending** - Initial state when tenant creates request
2. **In Progress** - When staff starts working on request
3. **Completed** - When work is finished
4. **Cancelled** - When request is cancelled
5. **On Hold** - When work is temporarily paused

### Chat States
1. **Active** - Ongoing conversation
2. **Archived** - Archived conversation
3. **Closed** - Closed conversation

### User Roles
- **MANAGER** - Property Manager (full access to property operations)
- **TENANT** - Tenant (limited to own data)
- **STAFF** - Staff member (access to assigned tasks/requests)

---

## Notes
- All workflows require JWT authentication
- Property isolation is enforced (tenants can only see their property's data)
- Real-time notifications are sent for important events
- Staff role is optional and can be enabled/disabled per property

