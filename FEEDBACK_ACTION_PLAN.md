# Feedback Action Plan

## Critical Issues (Fix First)

### 1. ✅ Privacy Policy (REQUIRED)
- **Status:** In Progress
- **Why:** Legal requirement for handling uploaded files
- **Action:** Create privacy policy page and add link to footer/contact form

### 2. ✅ Health Check Crash Bug
- **Status:** Identified
- **Issue:** `getHealthCheckTest()` receives port but checks for image name
- **Fix:** Pass docker image name instead of port to the method

## High Priority Features

### 3. Networks Configuration
- Add networks section to form
- Support custom network names
- Allow multiple networks per service

### 4. Labels Configuration
- Add labels section
- Support key-value pairs
- Common labels (com.docker.compose.project, etc.)

### 5. Multi-Service Support (Make Visible)
- Currently only supports one service at a time
- Add "Add Service" button
- Show list of services being configured
- Make dependencies work as checkboxes from existing services

### 6. Tooltips/Explanations
- Add help text for:
  - CPU limits (0.5 = half a core, not 0.5 of 16 cores)
  - Memory limits
  - Health check parameters
  - Port mappings
  - Volume mounts

### 7. Full Health Check Parameters
- Add: start_period, test (custom command)
- Better test command builder
- Preset test commands for common services

### 8. Dependencies as Checkboxes
- Show list of configured services
- Allow checkbox selection
- Auto-populate depends_on field

### 9. Better Form Validation
- Validate port ranges
- Validate CPU/memory formats
- Better error messages
- Prevent invalid configurations

## Medium Priority

### 10. Comparison to Existing Tools
- Add FAQ section explaining differences
- Position as "beginner-friendly" tool
- Acknowledge Portainer/Komodo/Rancher exist

### 11. Better Error Handling
- Catch and display errors gracefully
- Don't crash on invalid input
- Show helpful error messages

## Future Considerations (Not MVP)

- Drag-and-drop visual editor (major feature)
- Service templates library
- Integration with Docker Hub
- Team collaboration
- Environment-specific configs

## Positioning Changes

- **Current:** "Visual Docker Compose Editor"
- **Better:** "Form-Based Docker Compose Builder" or "Docker Compose Form Builder"
- **Target:** Beginners and people who want quick configs without YAML syntax
- **Acknowledge:** Not for advanced users who prefer YAML directly

