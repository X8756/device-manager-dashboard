"use strict";

const API_BASE_URL =
    "https://device-manager-backend-e1b3.onrender.com";

const API_URL = `${API_BASE_URL}/api/devices`;
const TOKEN_KEY = "deviceManagerToken";

let authToken = localStorage.getItem(TOKEN_KEY);
let devices = [];
let selectedDevice = null;
let socket = null;
let refreshTimer = null;

const REQUEST_TYPES = [
    { value: "camera", label: "Camera", icon: "📷" },
    { value: "microphone", label: "Microphone", icon: "🎙️" },
    { value: "contacts", label: "Contacts", icon: "👥" },
    { value: "location", label: "Foreground location", icon: "📍" },
    {
        value: "background_location",
        label: "Background location",
        icon: "🗺️"
    },
    { value: "media", label: "Media access", icon: "🖼️" }
];

document.addEventListener("DOMContentLoaded", () => {
    addRequestStyles();
    initializeDashboard();
});

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getElement(id) {
    return document.getElementById(id);
}

function addRequestStyles() {
    if (getElement("requestStyles")) return;

    const style = document.createElement("style");
    style.id = "requestStyles";
    style.textContent = `
        .request-section {
            margin-top: 24px;
            padding: 20px;
            border: 1px solid #dfe3e8;
            border-radius: 12px;
            background: #fff;
        }

        .request-section h3 {
            margin: 0 0 8px;
        }

        .request-note {
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
            margin: 0 0 16px;
        }

        .request-grid {
            display: grid;
            grid-template-columns: repeat(
                auto-fit, minmax(180px, 1fr)
            );
            gap: 10px;
        }

        .request-button {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            width: 100%;
            padding: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #f8fafc;
            color: #172033;
            cursor: pointer;
            font-size: 14px;
            text-align: left;
        }

        .request-button:hover {
            background: #eaf2ff;
            border-color: #6597e8;
        }

        .request-button:disabled {
            opacity: .55;
            cursor: wait;
        }

        .request-message {
            margin-top: 14px;
            font-size: 14px;
            line-height: 1.5;
        }

        .request-message.error {
            color: #b91c1c;
        }

        .request-message.success {
            color: #166534;
        }

        .request-message.info {
            color: #334155;
        }

        .login-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: #f1f5f9;
        }

        .login-card {
            width: 100%;
            max-width: 380px;
            padding: 28px;
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(15, 23, 42, .12);
        }

        .login-card h2 {
            margin-top: 0;
        }

        .login-card label {
            display: block;
            margin: 14px 0 6px;
        }

        .login-card input {
            box-sizing: border-box;
            width: 100%;
            padding: 11px;
            border: 1px solid #cbd5e1;
            border-radius: 7px;
        }

        .login-card button {
            width: 100%;
            margin-top: 18px;
            padding: 11px;
            border: 0;
            border-radius: 7px;
            color: white;
            background: #2563eb;
            cursor: pointer;
        }

        .login-error {
            color: #b91c1c;
            margin-top: 12px;
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);
}

function showLogin() {
    disconnectSocket();
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    let overlay = getElement("loginOverlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loginOverlay";
        overlay.className = "login-overlay";

        overlay.innerHTML = `
            <form id="loginForm" class="login-card">
                <h2>Device Manager</h2>
                <p>Sign in to access your dashboard.</p>

                <label for="loginUsername">Username</label>
                <input
                    id="loginUsername"
                    name="username"
                    autocomplete="username"
                    required
                >

                <label for="loginPassword">Password</label>
                <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required
                >

                <button type="submit">Log in</button>
                <div id="loginError" class="login-error"></div>
            </form>
        `;

        document.body.appendChild(overlay);

        getElement("loginForm").addEventListener(
            "submit",
            login
        );
    }

    overlay.style.display = "flex";
}

async function login(event) {
    event.preventDefault();

    const username = getElement("loginUsername").value.trim();
    const password = getElement("loginPassword").value;
    const errorElement = getElement("loginError");

    errorElement.textContent = "Signing in...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.token) {
            throw new Error(
                data.message || "Login failed. Check your credentials."
            );
        }

        authToken = data.token;
        localStorage.setItem(TOKEN_KEY, authToken);

        const overlay = getElement("loginOverlay");
        if (overlay) overlay.style.display = "none";

        await initializeDashboard();
    } catch (error) {
        errorElement.textContent = error.message;
    }
}

function logout() {
    authToken = null;
    selectedDevice = null;
    localStorage.removeItem(TOKEN_KEY);
    disconnectSocket();

    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    showLogin();
}

async function authenticatedFetch(url, options = {}) {
    if (!authToken) {
        throw new Error("Please log in again.");
    }

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error("Your session expired. Please log in again.");
    }

    return response;
}

function extractDeviceList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.devices)) return data.devices;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
}

async function loadDevices() {
    try {
        const response = await authenticatedFetch(API_URL);

        if (!response.ok) {
            throw new Error(`Unable to load devices (HTTP ${response.status}).`);
        }

        const data = await response.json();
        devices = extractDeviceList(data);

        updateSummary();
        renderDeviceList();

        if (selectedDevice) {
            const latest = devices.find(
                device => String(device.id) === String(selectedDevice.id)
            );

            if (latest) {
                selectedDevice = latest;
                renderDeviceDetails(latest);
            } else {
                closeDeviceDetails();
            }
        }
    } catch (error) {
        if (error.message.includes("session expired")) return;
        console.error("Device loading error:", error);

        const list = getElement("deviceList");
        if (list) {
            list.innerHTML = `
                <div class="loading">
                    ${escapeHTML(error.message)}
                </div>
            `;
        }
    }
}

function isOnline(device) {
    return device.is_online === true ||
        device.is_online === "true" ||
        device.status === "online";
}

function updateSummary() {
    const online = devices.filter(isOnline).length;

    if (getElement("totalDevices")) {
        getElement("totalDevices").textContent = devices.length;
    }
    if (getElement("onlineDevices")) {
        getElement("onlineDevices").textContent = online;
    }
    if (getElement("offlineDevices")) {
        getElement("offlineDevices").textContent =
            devices.length - online;
    }

    const status = getElement("connectionStatus");
    if (status) {
        status.textContent = "Backend: Connected";
        status.classList.remove("offline");
        status.classList.add("online");
    }
}

function renderDeviceList() {
    const container = getElement("deviceList");
    if (!container) return;

    const search = (getElement("searchInput")?.value || "")
        .toLowerCase()
        .trim();

    const filter = getElement("statusFilter")?.value || "all";

    const filtered = devices.filter(device => {
        const text = [
            device.device_name,
            device.manufacturer,
            device.model,
            device.android_version,
            device.device_uuid
        ].join(" ").toLowerCase();

        if (search && !text.includes(search)) return false;
        if (filter === "online" && !isOnline(device)) return false;
        if (filter === "offline" && isOnline(device)) return false;

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="loading">
                ${devices.length
                    ? "No devices match your search."
                    : "No enrolled devices found."}
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(device => `
        <button
            type="button"
            class="device-card"
            data-device-id="${escapeHTML(device.id)}"
            style="text-align:left;cursor:pointer;"
        >
            <div class="device-header">
                <strong>${escapeHTML(device.device_name || device.model || "Android device")}</strong>
                <span class="${isOnline(device) ? "status-online" : "status-offline"}">
                    ${isOnline(device) ? "Online" : "Offline"}
                </span>
            </div>
            <p>${escapeHTML(device.manufacturer || "")}
               ${escapeHTML(device.model || "")}</p>
            <p>Android ${escapeHTML(device.android_version || "Unknown")}</p>
        </button>
    `).join("");

    container.querySelectorAll("[data-device-id]").forEach(button => {
        button.addEventListener("click", () => {
            const device = devices.find(
                item => String(item.id) === button.dataset.deviceId
            );
            if (device) openDeviceDetails(device);
        });
    });
}

function openDeviceDetails(device) {
    selectedDevice = device;

    if (getElement("deviceList")) {
        getElement("deviceList").style.display = "none";
    }

    const details = getElement("deviceDetails");
    if (details) details.style.display = "block";

    renderDeviceDetails(device);
}

function closeDeviceDetails() {
    selectedDevice = null;

    if (getElement("deviceDetails")) {
        getElement("deviceDetails").style.display = "none";
    }
    if (getElement("deviceList")) {
        getElement("deviceList").style.display = "";
    }
}

function getPermissionValues(device) {
    const p = device.permissions ||
        device.device_permissions ||
        device.permission_status ||
        {};

    return {
        camera: p.camera,
        microphone: p.microphone,
        contacts: p.contacts,
        location_foreground:
            p.location_foreground ?? p.locationForeground,
        location_background:
            p.location_background ?? p.locationBackground,
        media: p.media
    };
}

function permissionLabel(value) {
    if (value === true || value === "true") {
        return '<span class="permission-granted">✓ Granted</span>';
    }

    return '<span class="permission-denied">✕ Denied</span>';
}

function renderDeviceDetails(device) {
    const content = getElement("deviceDetailsContent");
    if (!content) return;

    const permissions = getPermissionValues(device);
    const online = isOnline(device);

    const permissionRows = [
        ["Camera", permissions.camera],
        ["Microphone", permissions.microphone],
        ["Contacts", permissions.contacts],
        ["Foreground Location", permissions.location_foreground],
        ["Background Location", permissions.location_background],
        ["Media", permissions.media]
    ];

    const rows = permissionRows.map(([label, value]) => `
        <div class="permission-row">
            <span>${escapeHTML(label)}</span>
            <span>${permissionLabel(value)}</span>
        </div>
    `).join("");

    const requests = REQUEST_TYPES.map(request => `
        <button
            type="button"
            class="request-button"
            data-request-type="${escapeHTML(request.value)}"
        >
            <span>${request.icon}</span>
            <span>Request ${escapeHTML(request.label)}</span>
        </button>
    `).join("");

    content.innerHTML = `
        <div class="details-section">
            <h2>${escapeHTML(device.device_name || device.model || "Device")}</h2>
            <p>${online ? "🟢 Online" : "🔴 Offline"}</p>

            <h3>Device Information</h3>
            <div class="permission-row">
                <span>Device ID</span>
                <span>${escapeHTML(device.device_uuid || device.id)}</span>
            </div>
            <div class="permission-row">
                <span>Manufacturer</span>
                <span>${escapeHTML(device.manufacturer || "Unknown")}</span>
            </div>
            <div class="permission-row">
                <span>Model</span>
                <span>${escapeHTML(device.model || "Unknown")}</span>
            </div>
            <div class="permission-row">
                <span>Android Version</span>
                <span>${escapeHTML(device.android_version || "Unknown")}</span>
            </div>
            <div class="permission-row">
                <span>App Version</span>
                <span>${escapeHTML(device.app_version || "Unknown")}</span>
            </div>
            <div class="permission-row">
                <span>Registered</span>
                <span>${escapeHTML(formatDate(device.created_at))}</span>
            </div>
            <div class="permission-row">
                <span>Last Seen</span>
                <span>${escapeHTML(formatDate(device.last_seen))}</span>
            </div>
        </div>

        <div class="details-section">
            <h3>Permission Status</h3>
            ${rows}
        </div>

        <section class="request-section">
            <h3>Request a Device Permission</h3>
            <p class="request-note">
                Choose a request to send to this enrolled device.
                A request is not a permission grant. The Android app
                must receive it and show the appropriate user-approved
                permission flow.
            </p>
            <div class="request-grid">
                ${requests}
            </div>
            <div
                id="requestMessage"
                class="request-message"
                role="status"
                aria-live="polite"
            ></div>
        </section>
    `;

    content.querySelectorAll("[data-request-type]").forEach(button => {
        button.addEventListener("click", () => {
            sendDeviceRequest(
                device,
                button.dataset.requestType,
                button
            );
        });
    });

    const backButton = getElement("closeDeviceDetails");
    if (backButton) {
        backButton.onclick = closeDeviceDetails;
    }
}

async function sendDeviceRequest(device, requestType, button) {
    const message = getElement("requestMessage");
    if (!message) return;

    if (!device.id) {
        message.className = "request-message error";
    message.textContent = "This device has no database ID.";
        return;
    }

    const request = REQUEST_TYPES.find(
        item => item.value === requestType
    );

    if (!request) return;

    const confirmed = window.confirm(
        `Send a ${request.label} request to ` +
        `${device.device_name || device.model || "this device"}?`
    );

    if (!confirmed) return;

    const originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = "Sending request...";

    message.className = "request-message info";
    message.textContent = "Contacting backend...";

    try {
        const response = await authenticatedFetch(
            `${API_URL}/request`,
            {
                method: "POST",
                body: JSON.stringify({
                    device_id: Number(device.id),
                    request_type: requestType
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                `Request failed (HTTP ${response.status}).`
            );
        }

        message.className = "request-message success";
        message.textContent =
            `${request.label} request created successfully. ` +
            "It is pending until the Android app receives and handles it.";

    } catch (error) {
        message.className = "request-message error";
        message.textContent = error.message;
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function formatDate(value) {
    if (!value) return "Unknown";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return date.toLocaleString();
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

function connectSocket() {
    disconnectSocket();

    if (typeof io !== "function" || !authToken) return;

    socket = io(API_BASE_URL, {
        auth: { token: authToken },
        reconnection: true
    });

    socket.on("connect", () => {
        const status = getElement("connectionStatus");
        if (status) {
            status.textContent = "Backend: Connected";
            status.classList.remove("offline");
            status.classList.add("online");
        }
    });

    socket.on("connect_error", error => {
        console.warn("Dashboard socket connection error:", error.message);
    });

    socket.on("devices_updated", loadDevices);
    socket.on("device_request_created", loadDevices);

    socket.on("disconnect", () => {
        const status = getElement("connectionStatus");
        if (status) {
            status.textContent = "Backend: Reconnecting...";
            status.classList.remove("online");
            status.classList.add("offline");
        }
    });
}

function setupDashboardEvents() {
    const search = getElement("searchInput");
    const filter = getElement("statusFilter");
    const logoutButton = getElement("logoutButton");

    if (search) {
        search.oninput = renderDeviceList;
    }

    if (filter) {
        filter.onchange = renderDeviceList;
    }

    if (logoutButton) {
        logoutButton.onclick = logout;
    }

    if (getElement("closeDeviceDetails")) {
        getElement("closeDeviceDetails").onclick = closeDeviceDetails;
    }
}

async function initializeDashboard() {
    if (!authToken) {
        showLogin();
        return;
    }

    const overlay = getElement("loginOverlay");
    if (overlay) overlay.style.display = "none";

    setupDashboardEvents();

    await loadDevices();
    connectSocket();

    if (refreshTimer) clearInterval(refreshTimer);

    // Fallback refresh if a socket update is missed.
    refreshTimer = setInterval(loadDevices, 15000);
}

