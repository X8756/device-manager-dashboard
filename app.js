const API_BASE_URL =
    "https://device-manager-backend-e1b3.onrender.com";

const API_URL =
    `${API_BASE_URL}/api/devices`;


// ==========================================
// AUTHENTICATION
// ==========================================

let authToken =
    localStorage.getItem("deviceManagerToken");


// ==========================================
// GLOBAL DEVICE DATA
// ==========================================

let allDevices = [];


// ==========================================
// SELECTED DEVICE
// ==========================================

let selectedDeviceUuid = null;


// ==========================================
// DASHBOARD LOAD STATE
// ==========================================

let isLoadingDevices = false;


// ==========================================
// SOCKET
// ==========================================

let socket = null;


// ==========================================
// CREATE LOGIN SCREEN
// ==========================================

function createLoginScreen() {

    if (
        document.getElementById(
            "loginScreen"
        )
    ) {
        return;
    }

    const loginScreen =
        document.createElement("div");

    loginScreen.id =
        "loginScreen";

    loginScreen.innerHTML = `

        <div
            style="
                position:fixed;
                inset:0;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#f4f6f8;
                z-index:99999;
                padding:20px;
            "
        >

            <div
                style="
                    width:100%;
                    max-width:400px;
                    background:white;
                    border-radius:14px;
                    padding:30px;
                    box-shadow:0 10px 35px rgba(0,0,0,0.12);
                "
            >

                <h1
                    style="
                        margin-top:0;
                        margin-bottom:8px;
                    "
                >
                    Device Manager
                </h1>

                <p
                    style="
                        margin-top:0;
                        color:#666;
                    "
                >
                    Admin Dashboard Login
                </p>

                <form
                    id="loginForm"
                >

                    <label
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Username
                    </label>

                    <input
                        id="loginUsername"
                        type="text"
                        autocomplete="username"
                        placeholder="Username"
                        required
                        style="
                            width:100%;
                            box-sizing:border-box;
                            padding:12px;
                            margin-bottom:16px;
                            border:1px solid #ccc;
                            border-radius:8px;
                            font-size:15px;
                        "
                    >

                    <label
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Password
                    </label>

                    <input
                        id="loginPassword"
                        type="password"
                        autocomplete="current-password"
                        placeholder="Password"
                        required
                        style="
                            width:100%;
                            box-sizing:border-box;
                            padding:12px;
                            margin-bottom:16px;
                            border:1px solid #ccc;
                            border-radius:8px;
                            font-size:15px;
                        "
                    >

                    <button
                        id="loginButton"
                        type="submit"
                        style="
                            width:100%;
                            padding:12px;
                            border:0;
                            border-radius:8px;
                            cursor:pointer;
                            font-size:16px;
                            font-weight:600;
                        "
                    >
                        Login
                    </button>

                    <div
                        id="loginMessage"
                        style="
                            margin-top:15px;
                            min-height:20px;
                            text-align:center;
                        "
                    ></div>

                </form>

            </div>

        </div>
    `;

    document.body.appendChild(
        loginScreen
    );

    const loginForm =
        document.getElementById(
            "loginForm"
        );

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            await login();

        }
    );
}


// ==========================================
// SHOW LOGIN
// ==========================================

function showLoginScreen() {

    createLoginScreen();

    const loginScreen =
        document.getElementById(
            "loginScreen"
        );

    if (loginScreen) {

        loginScreen.style.display =
            "flex";

    }

    const username =
        document.getElementById(
            "loginUsername"
        );

    if (username) {

        username.focus();

    }
}


// ==========================================
// HIDE LOGIN
// ==========================================

function hideLoginScreen() {

    const loginScreen =
        document.getElementById(
            "loginScreen"
        );

    if (loginScreen) {

        loginScreen.style.display =
            "none";

    }
}


// ==========================================
// LOGIN
// ==========================================

async function login() {

    const username =
        document.getElementById(
            "loginUsername"
        ).value.trim();

    const password =
        document.getElementById(
            "loginPassword"
        ).value;

    const loginButton =
        document.getElementById(
            "loginButton"
        );

    const loginMessage =
        document.getElementById(
            "loginMessage"
        );

    loginButton.disabled =
        true;

    loginButton.textContent =
        "Logging in...";

    loginMessage.textContent =
        "";

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Login failed"
            );

        }

        if (!data.token) {

            throw new Error(
                "Login token was not received"
            );

        }

        authToken =
            data.token;

        localStorage.setItem(
            "deviceManagerToken",
            authToken
        );

        loginMessage.textContent =
            "Login successful";

        hideLoginScreen();

        connectSocket();

        await loadDevices();

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        loginMessage.textContent =
            error.message ||
            "Invalid username or password";

    } finally {

        loginButton.disabled =
            false;

        loginButton.textContent =
            "Login";

    }
}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    authToken =
        null;

    localStorage.removeItem(
        "deviceManagerToken"
    );

    allDevices =
        [];

    selectedDeviceUuid =
        null;

    if (socket) {

        socket.disconnect();

        socket =
            null;

    }

    showLoginScreen();
}


// ==========================================
// HANDLE AUTH FAILURE
// ==========================================

function handleAuthenticationFailure() {

    console.warn(
        "Dashboard authentication expired"
    );

    logout();
}


// ==========================================
// CREATE LOGOUT BUTTON
// ==========================================

function createLogoutButton() {

    if (
        document.getElementById(
            "dashboardLogoutButton"
        )
    ) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "dashboardLogoutButton";

    button.textContent =
        "Logout";

    button.type =
        "button";

    button.style.cssText = `
        position:fixed;
        top:15px;
        right:15px;
        z-index:9998;
        padding:9px 16px;
        border:0;
        border-radius:7px;
        cursor:pointer;
        font-weight:600;
    `;

    button.addEventListener(
        "click",
        logout
    );

    document.body.appendChild(
        button
    );
}


// ==========================================
// AUTHENTICATED API REQUEST
// ==========================================

async function authenticatedFetch(
    url,
    options = {}
) {

    if (!authToken) {

        handleAuthenticationFailure();

        throw new Error(
            "Authentication required"
        );

    }

    const headers = {

        ...(options.headers || {}),

        Authorization:
            `Bearer ${authToken}`

    };

    const response =
        await fetch(
            url,
            {
                ...options,
                headers
            }
        );

    if (
        response.status === 401
    ) {

        handleAuthenticationFailure();

        throw new Error(
            "Authentication expired"
        );

    }

    return response;
}


// ==========================================
// LOAD DEVICES
// ==========================================

async function loadDevices() {

    if (!authToken) {
        return;
    }

    if (isLoadingDevices) {
        return;
    }

    isLoadingDevices =
        true;

    const deviceList =
        document.getElementById(
            "deviceList"
        );

    const connectionStatus =
        document.getElementById(
            "connectionStatus"
        );

    if (
        allDevices.length === 0 &&
        deviceList
    ) {

        deviceList.innerHTML = `
            <div class="loading">
                Loading devices...
            </div>
        `;

    }

    try {

        const response =
            await authenticatedFetch(
                API_URL
            );

        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }

        const data =
            await response.json();

        if (connectionStatus) {

            connectionStatus.textContent =
                "Backend: Connected";

            connectionStatus.className =
                "connection online";

        }

        allDevices =
            data.devices || [];

        displayFilteredDevices();

        if (selectedDeviceUuid) {

            const selectedDevice =
                allDevices.find(
                    device =>
                        device.device_uuid ===
                        selectedDeviceUuid
                );

            if (selectedDevice) {

                displayDeviceDetails(
                    selectedDevice
                );

            } else {

                closeDeviceDetails();

            }

        }

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        if (!authToken) {
            return;
        }

        if (connectionStatus) {

            connectionStatus.textContent =
                "Backend: Disconnected";

            connectionStatus.className =
                "connection offline";

        }

        if (
            allDevices.length === 0 &&
            deviceList
        ) {

            deviceList.innerHTML = `
                <div class="empty">

                    Unable to connect to backend.

                    <br><br>

                    Make sure the Node.js server
                    is running.

                </div>
            `;

            updateSummary([]);

        }

    } finally {

        isLoadingDevices =
            false;

    }
}


// ==========================================
// FILTER DEVICES
// ==========================================

function displayFilteredDevices() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    const searchText =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const selectedStatus =
        statusFilter
            ? statusFilter.value
            : "all";

    const filteredDevices =
        allDevices.filter(
            device => {

                const searchableText =
                    [
                        device.device_name,
                        device.manufacturer,
                        device.model,
                        device.android_version,
                        device.app_version,
                        device.device_uuid
                    ]
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    searchText === "" ||
                    searchableText.includes(
                        searchText
                    );

                const isOnline =
                    device.is_online === true;

                let matchesStatus =
                    true;

                if (
                    selectedStatus ===
                    "online"
                ) {

                    matchesStatus =
                        isOnline;

                } else if (
                    selectedStatus ===
                    "offline"
                ) {

                    matchesStatus =
                        !isOnline;

                }

                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );

    displayDevices(
        filteredDevices
    );
}


// ==========================================
// DISPLAY DEVICES
// ==========================================

function displayDevices(
    devices
) {

    const deviceList =
        document.getElementById(
            "deviceList"
        );

    updateSummary(
        allDevices
    );

    if (
        !devices ||
        devices.length === 0
    ) {

        deviceList.innerHTML = `
            <div class="empty">
                No matching devices found.
            </div>
        `;

        return;
    }

    deviceList.innerHTML =
        devices
            .map(
                device =>
                    createDeviceCard(
                        device
                    )
            )
            .join("");
}


// ==========================================
// CREATE DEVICE CARD
// ==========================================

function createDeviceCard(
    device
) {

    const online =
        device.is_online === true;

    const statusClass =
        online
            ? "status-online"
            : "status-offline";

    const statusText =
        online
            ? "Online"
            : "Offline";

    const deviceIndex =
        allDevices.findIndex(
            item =>
                item.device_uuid ===
                device.device_uuid
        );

    const deviceNumber =
        deviceIndex >= 0
            ? deviceIndex + 1
            : "";

    return `
        <div
            class="device-card"
            data-device-uuid="${escapeHtml(
                device.device_uuid
            )}"
            onclick="openDeviceDetails(
                '${escapeJs(
                    device.device_uuid
                )}'
            )"
        >

            <div class="device-header">

                <div class="device-title-area">

                    <div class="device-number">
                        Device ${deviceNumber}
                    </div>

                    <h3 class="device-name">
                        ${escapeHtml(
                            device.device_name
                        )}
                    </h3>

                    <div class="device-model">

                        ${escapeHtml(
                            device.manufacturer
                        )}

                        ${escapeHtml(
                            device.model
                        )}

                    </div>

                </div>

                <div class="status">

                    <span
                        class="status-dot ${statusClass}"
                    ></span>

                    <span class="status-text">
                        ${statusText}
                    </span>

                </div>

            </div>

            <div class="device-info">

                <div class="info-row">

                    <span class="info-label">
                        Android
                    </span>

                    <span class="info-value">
                        ${escapeHtml(
                            device.android_version
                        )}
                    </span>

                </div>

                <div class="info-row">

                    <span class="info-label">
                        App Version
                    </span>

                    <span class="info-value">
                        ${escapeHtml(
                            device.app_version
                        )}
                    </span>

                </div>

                <div class="info-row">

                    <span class="info-label">
                        Device ID
                    </span>

                    <span class="info-value device-id">
                        ${escapeHtml(
                            device.device_uuid
                        )}
                    </span>

                </div>

                <div class="info-row">

                    <span class="info-label">
                        Registered
                    </span>

                    <span class="info-value">
                        ${formatDate(
                            device.created_at
                        )}
                    </span>

                </div>

                <div class="info-row">

                    <span class="info-label">
                        Last Seen
                    </span>

                    <span
                        class="info-value last-seen"
                        data-last-seen="${escapeHtml(
                            device.last_seen
                        )}"
                    >
                        ${formatDate(
                            device.last_seen
                        )}
                    </span>

                </div>

                <div class="info-row">

                    <span class="info-label">
                        Activity
                    </span>

                    <span
                        class="info-value activity-time"
                        data-last-seen="${escapeHtml(
                            device.last_seen
                        )}"
                    >
                        ${timeAgo(
                            device.last_seen
                        )}
                    </span>

                </div>

            </div>

            <div class="permissions">

                <h3>
                    Permissions
                </h3>

                ${permissionRow(
                    "Camera",
                    device.camera
                )}

                ${permissionRow(
                    "Microphone",
                    device.microphone
                )}

                ${permissionRow(
                    "Contacts",
                    device.contacts
                )}

                ${permissionRow(
                    "Foreground Location",
                    device.location_foreground
                )}

                ${permissionRow(
                    "Background Location",
                    device.location_background
                )}

                ${permissionRow(
                    "Media",
                    device.media
                )}

            </div>

            <div class="device-card-footer">
                Click to view device details →
            </div>

        </div>
    `;
}


// ==========================================
// OPEN DEVICE DETAILS
// ==========================================

function openDeviceDetails(
    deviceUuid
) {

    const device =
        allDevices.find(
            item =>
                item.device_uuid ===
                deviceUuid
        );

    if (!device) {

        console.error(
            "Device not found:",
            deviceUuid
        );

        return;
    }

    selectedDeviceUuid =
        deviceUuid;

    displayDeviceDetails(
        device
    );

    const deviceList =
        document.getElementById(
            "deviceList"
        );

    const deviceControls =
        document.querySelector(
            ".device-controls"
        );

    const sectionHeader =
        document.querySelector(
            ".section-header"
        );

    const deviceDetails =
        document.getElementById(
            "deviceDetails"
        );

    if (deviceList) {

        deviceList.style.display =
            "none";

    }

    if (deviceControls) {

        deviceControls.style.display =
            "none";

    }

    if (sectionHeader) {

        sectionHeader.style.display =
            "none";

    }

    if (deviceDetails) {

        deviceDetails.style.display =
            "block";

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ==========================================
// DISPLAY DEVICE DETAILS
// ==========================================

function displayDeviceDetails(
    device
) {

    const content =
        document.getElementById(
            "deviceDetailsContent"
        );

    if (!content) {
        return;
    }

    const online =
        device.is_online === true;

    const statusClass =
        online
            ? "status-online"
            : "status-offline";

    const statusText =
        online
            ? "Online"
            : "Offline";

    const deviceIndex =
        allDevices.findIndex(
            item =>
                item.device_uuid ===
                device.device_uuid
        );

    const deviceNumber =
        deviceIndex >= 0
            ? deviceIndex + 1
            : "";

    content.innerHTML = `

        <div class="details-card">

            <div class="details-title">

                <div>

                    <div class="device-number">
                        Device ${deviceNumber}
                    </div>

                    <h2>
                        ${escapeHtml(
                            device.device_name
                        )}
                    </h2>

                    <p>

                        ${escapeHtml(
                            device.manufacturer
                        )}

                        ${escapeHtml(
                            device.model
                        )}

                    </p>

                </div>

                <div class="status details-status">

                    <span
                        class="status-dot ${statusClass}"
                    ></span>

                    <span class="status-text">
                        ${statusText}
                    </span>

                </div>

            </div>

            <div class="details-section">

                <h3>
                    Device Information
                </h3>

                ${detailRow(
                    "Device ID",
                    device.device_uuid
                )}

                ${detailRow(
                    "Manufacturer",
                    device.manufacturer
                )}

                ${detailRow(
                    "Model",
                    device.model
                )}

                ${detailRow(
                    "Android Version",
                    device.android_version
                )}

                ${detailRow(
                    "App Version",
                    device.app_version
                )}

                ${detailRow(
                    "Registered",
                    formatDate(
                        device.created_at
                    )
                )}

                ${detailRow(
                    "Last Seen",
                    formatDate(
                        device.last_seen
                    )
                )}

                ${detailRow(
                    "Activity",
                    timeAgo(
                        device.last_seen
                    )
                )}

            </div>

            <div class="details-section">

                <h3>
                    Permission Status
                </h3>

                ${permissionDetailRow(
                    "Camera",
                    device.camera
                )}

                ${permissionDetailRow(
                    "Microphone",
                    device.microphone
                )}

                ${permissionDetailRow(
                    "Contacts",
                    device.contacts
                )}

                ${permissionDetailRow(
                    "Foreground Location",
                    device.location_foreground
                )}

                ${permissionDetailRow(
                    "Background Location",
                    device.location_background
                )}

                ${permissionDetailRow(
                    "Media",
                    device.media
                )}

            </div>

        </div>
    `;
}


// ==========================================
// DETAIL ROW
// ==========================================

function detailRow(
    label,
    value
) {

    return `
        <div class="detail-row">

            <span class="detail-label">
                ${escapeHtml(label)}
            </span>

            <span class="detail-value">
                ${escapeHtml(value)}
            </span>

        </div>
    `;
}


// ==========================================
// PERMISSION DETAIL ROW
// ==========================================

function permissionDetailRow(
    name,
    granted
) {

    const statusClass =
        granted
            ? "permission-granted"
            : "permission-denied";

    const statusIcon =
        granted
            ? "✓"
            : "✕";

    const statusText =
        granted
            ? "Granted"
            : "Denied";

    return `
        <div class="permission-detail-row">

            <span class="permission-name">
                ${escapeHtml(name)}
            </span>

            <span class="${statusClass}">

                <span class="permission-icon">
                    ${statusIcon}
                </span>

                ${statusText}

            </span>

        </div>
    `;
}


// ==========================================
// CLOSE DEVICE DETAILS
// ==========================================

function closeDeviceDetails() {

    selectedDeviceUuid =
        null;

    const deviceList =
        document.getElementById(
            "deviceList"
        );

    const deviceControls =
        document.querySelector(
            ".device-controls"
        );

    const sectionHeader =
        document.querySelector(
            ".section-header"
        );

    const deviceDetails =
        document.getElementById(
            "deviceDetails"
        );

    if (deviceList) {

        deviceList.style.display =
            "";

    }

    if (deviceControls) {

        deviceControls.style.display =
            "";

    }

    if (sectionHeader) {

        sectionHeader.style.display =
            "";

    }

    if (deviceDetails) {

        deviceDetails.style.display =
            "none";

    }
}


// ==========================================
// PERMISSION ROW
// ==========================================

function permissionRow(
    name,
    granted
) {

    const statusClass =
        granted
            ? "permission-granted"
            : "permission-denied";

    const statusIcon =
        granted
            ? "✓"
            : "✕";

    const statusText =
        granted
            ? "Granted"
            : "Denied";

    return `
        <div class="permission-row">

            <span class="permission-name">
                ${escapeHtml(name)}
            </span>

            <span class="${statusClass}">

                <span class="permission-icon">
                    ${statusIcon}
                </span>

                ${statusText}

            </span>

        </div>
    `;
}


// ==========================================
// SUMMARY
// ==========================================

function updateSummary(
    devices
) {

    const total =
        devices.length;

    const online =
        devices.filter(
            device =>
                device.is_online === true
        ).length;

    const offline =
        total - online;

    const totalElement =
        document.getElementById(
            "totalDevices"
        );

    const onlineElement =
        document.getElementById(
            "onlineDevices"
        );

    const offlineElement =
        document.getElementById(
            "offlineDevices"
        );

    if (totalElement) {

        totalElement.textContent =
            total;

    }

    if (onlineElement) {

        onlineElement.textContent =
            online;

    }

    if (offlineElement) {

        offlineElement.textContent =
            offline;

    }
}


// ==========================================
// DATE FORMAT
// ==========================================

function formatDate(
    dateString
) {

    if (!dateString) {
        return "Never";
    }

    const date =
        new Date(
            dateString
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Unknown";
    }

    return date.toLocaleString();
}


// ==========================================
// TIME AGO
// ==========================================

function timeAgo(
    dateString
) {

    if (!dateString) {
        return "Never";
    }

    const date =
        new Date(
            dateString
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Unknown";
    }

    const difference =
        Math.floor(
            (
                Date.now() -
                date.getTime()
            ) / 1000
        );

    if (difference < 0) {
        return "Just now";
    }

    if (difference < 5) {
        return "Just now";
    }

    if (difference < 60) {

        return (
            difference +
            " seconds ago"
        );

    }

    const minutes =
        Math.floor(
            difference / 60
        );

    if (minutes < 60) {

        return (
            minutes +
            (
                minutes === 1
                    ? " minute ago"
                    : " minutes ago"
            )
        );

    }

    const hours =
        Math.floor(
            minutes / 60
        );

    if (hours < 24) {

        return (
            hours +
            (
                hours === 1
                    ? " hour ago"
                    : " hours ago"
            )
        );

    }

    const days =
        Math.floor(
            hours / 24
        );

    return (
        days +
        (
            days === 1
                ? " day ago"
                : " days ago"
        )
    );
}


// ==========================================
// UPDATE RELATIVE TIMES
// ==========================================

function updateRelativeTimes() {

    const elements =
        document.querySelectorAll(
            ".activity-time"
        );

    elements.forEach(
        element => {

            element.textContent =
                timeAgo(
                    element.dataset.lastSeen
                );

        }
    );
}


// ==========================================
// UPDATE DEVICE FROM HEARTBEAT
// ==========================================

function updateDeviceFromHeartbeat(
    heartbeatDevice
) {

    if (
        !heartbeatDevice ||
        !heartbeatDevice.device_uuid
    ) {
        return;
    }

    const deviceIndex =
        allDevices.findIndex(
            device =>
                device.device_uuid ===
                heartbeatDevice.device_uuid
        );

    if (deviceIndex === -1) {

        console.log(
            "New device detected:",
            heartbeatDevice.device_uuid
        );

        loadDevices();

        return;
    }

    allDevices[deviceIndex] = {

        ...allDevices[deviceIndex],

        ...heartbeatDevice

    };

    if (
        selectedDeviceUuid ===
        heartbeatDevice.device_uuid
    ) {

        displayDeviceDetails(
            allDevices[deviceIndex]
        );

        return;
    }

    displayFilteredDevices();
}


// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


// ==========================================
// JAVASCRIPT STRING ESCAPE
// ==========================================

function escapeJs(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        .replaceAll(
            "\\",
            "\\\\"
        )

        .replaceAll(
            "'",
            "\\'"
        )

        .replaceAll(
            "\n",
            "\\n"
        )

        .replaceAll(
            "\r",
            "\\r"
        );
}


// ==========================================
// SEARCH EVENT
// ==========================================

const searchInput =
    document.getElementById(
        "searchInput"
    );

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            displayFilteredDevices();

        }
    );
}


// ==========================================
// STATUS FILTER EVENT
// ==========================================

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        () => {

            displayFilteredDevices();

        }
    );
}


// ==========================================
// CLOSE DETAILS BUTTON
// ==========================================

const closeDeviceDetailsButton =
    document.getElementById(
        "closeDeviceDetails"
    );

if (closeDeviceDetailsButton) {

    closeDeviceDetailsButton.addEventListener(
        "click",
        () => {

            closeDeviceDetails();

        }
    );
}


// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

function connectSocket() {

    if (!authToken) {
        return;
    }

    if (socket) {

        socket.disconnect();

        socket =
            null;

    }

    socket =
        io(
            API_BASE_URL,
            {
                auth: {
                    token:
                        authToken
                }
            }
        );

    socket.on(
        "connect",
        () => {

            console.log(
                "Authenticated WebSocket connected:",
                socket.id
            );

            loadDevices();

        }
    );

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "WebSocket authentication error:",
                error.message
            );

            if (
                error.message.includes(
                    "token"
                ) ||
                error.message.includes(
                    "Authentication"
                ) ||
                error.message.includes(
                    "expired"
                ) ||
                error.message.includes(
                    "Invalid"
                )
            ) {

                handleAuthenticationFailure();

            }

        }
    );

    socket.on(
        "disconnect",
        () => {

            console.log(
                "WebSocket disconnected"
            );

        }
    );

    socket.on(
        "devices_updated",
        () => {

            console.log(
                "Device list updated"
            );

            loadDevices();

        }
    );

    socket.on(
        "device_heartbeat",
        (device) => {

            console.log(
                "Heartbeat received:",
                device.device_uuid
            );

            updateDeviceFromHeartbeat(
                device
            );

        }
    );
}


// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

function initializeDashboard() {

    createLoginScreen();

    createLogoutButton();

    if (authToken) {

        hideLoginScreen();

        connectSocket();

        loadDevices();

    } else {

        showLoginScreen();

    }
}


// ==========================================
// FALLBACK REFRESH
// ==========================================

setInterval(
    () => {

        if (authToken) {

            loadDevices();

        }

    },
    30000
);


// ==========================================
// UPDATE ACTIVITY TIME
// ==========================================

setInterval(
    updateRelativeTimes,
    1000
);


// ==========================================
// START
// ==========================================

initializeDashboard();
