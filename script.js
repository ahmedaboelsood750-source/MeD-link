
"use strict";

// MedLink demo prototype.
// localStorage is for testing only, not real patient data.

const DB = {
  users: "medlink_users",
  current: "medlink_current",
  requests: "medlink_requests"
};

function read(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function currentUser() {
  const id = localStorage.getItem(DB.current);
  return read(DB.users, []).find(user => user.id === id) || null;
}

function setMessage(id, message, error = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}

function goToDashboard(user) {
  location.href = user.role === "student"
    ? "student-dashboard.html"
    : "patient-dashboard.html";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Show the correct registration fields.
function setupRegistration() {
  const role = document.getElementById("role");
  if (!role) return;

  const patientFields = document.getElementById("patientFields");
  const studentFields = document.getElementById("studentFields");
  const locationField = document.getElementById("location");
  const concernField = document.getElementById("concern");
  const universityField = document.getElementById("university");
  const yearField = document.getElementById("year");

  function updateFields() {
    const isPatient = role.value === "patient";
    const isStudent = role.value === "student";

    patientFields.hidden = !isPatient;
    studentFields.hidden = !isStudent;

    locationField.required = isPatient;
    concernField.required = false;
    universityField.required = isStudent;
    yearField.required = isStudent;
  }

  role.addEventListener("change", updateFields);
  updateFields();

  document.getElementById("registerForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const form = event.currentTarget;
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const users = read(DB.users, []);
      const email = String(data.get("email")).trim().toLowerCase();

      if (users.some(user => user.email === email)) {
        setMessage("registerMessage",
          "An account with this email already exists.", true);
        return;
      }

      const user = {
        id: crypto.randomUUID(),
        role: data.get("role"),
        name: String(data.get("name")).trim(),
        email,
        phone: String(data.get("phone")).trim(),
        age: Number(data.get("age")),
        location: data.get("location") || "",
        concern: data.get("concern") || "",
        university: data.get("university") || "",
        year: data.get("year") || "",
        // Demo only: never store real passwords this way.
        password: data.get("password")
      };

      users.push(user);
      write(DB.users, users);
      localStorage.setItem(DB.current, user.id);

      goToDashboard(user);
    });
}

// Login for previously registered demo accounts.
function setupLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("email")
      .value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    const user = read(DB.users, []).find(item =>
      item.email === email && item.password === password
    );

    if (!user) {
      setMessage("loginMessage",
        "Incorrect email or password.", true);
      return;
    }

    localStorage.setItem(DB.current, user.id);
    goToDashboard(user);
  });
}

// Require a demo login for protected pages.
function protectPage() {
  const page = document.body.dataset.page;
  const user = currentUser();

  if (page && (!user || user.role !== page)) {
    location.replace("login.html");
    return null;
  }

  if (!page && !user &&
      ["appointments.html", "profile.html"].includes(
        location.pathname.split("/").pop()
      )) {
    location.replace("login.html");
    return null;
  }

  return user;
}

function setupWelcome(user) {
  const title = document.getElementById("welcomeTitle");
  if (title && user) {
    title.textContent = `Welcome, ${user.name}!`;
  }
}

// Patient creates a request.
function setupPatientRequests(user) {
  const form = document.getElementById("requestForm");
  if (!form || !user) return;

  const dateInput = document.getElementById("requestDate");
  dateInput.min = new Date().toLocaleDateString("en-CA");

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const requests = read(DB.requests, []);
    requests.unshift({
      id: crypto.randomUUID(),
      patientId: user.id,
      patientName: user.name,
      service: document.getElementById("service").value,
      details: document.getElementById("requestDetails").value.trim(),
      date: dateInput.value,
      status: "Pending",
      studentId: null,
      createdAt: new Date().toISOString()
    });

    write(DB.requests, requests);
    form.reset();

    setMessage("requestMessage",
      "Your demo request has been submitted.");
    renderRequests(user, "patientRequests");
  });
}

function renderRequests(user, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !user) return;

  const requests = read(DB.requests, []);
  const mine = user.role === "patient"
    ? requests.filter(r => r.patientId === user.id)
    : requests.filter(r =>
        r.status === "Pending" || r.studentId === user.id
      );

  container.replaceChildren();

  if (!mine.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = user.role === "patient"
      ? "You have not submitted any requests yet."
      : "There are no available requests right now.";
    container.appendChild(empty);
    return;
  }

  mine.forEach(request => {
    const card = document.createElement("article");
    card.className = "card request-card";

    const title = document.createElement("h3");
    title.textContent = request.service;

    const date = document.createElement("p");
    date.textContent = `Preferred date: ${request.date}`;

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = request.status;

    const description = document.createElement("p");
    description.textContent = request.details || "No extra details.";

    card.append(title, date, status, description);

    if (user.role === "student") {
      const patient = document.createElement("p");
      patient.textContent = `Patient: ${request.patientName}`;
      card.appendChild(patient);

      if (request.status === "Pending") {
        const accept = document.createElement("button");
        accept.className = "btn";
        accept.textContent = "Accept Request";

        accept.addEventListener("click", () => {
          updateRequest(request.id, {
            status: "Accepted",
            studentId: user.id
          });
          renderRequests(user, containerId);
        });

        const decline = document.createElement("button");
        decline.className = "btn btn-light";
        decline.textContent = "Decline";

        decline.addEventListener("click", () => {
          updateRequest(request.id, { status: "Declined" });
          renderRequests(user, containerId);
        });

        card.append(accept, decline);
      }
    }

    container.appendChild(card);
  });
}

function updateRequest(id, changes) {
  const requests = read(DB.requests, []);
  const index = requests.findIndex(request => request.id === id);
  if (index < 0) return;

  requests[index] = { ...requests[index], ...changes };
  write(DB.requests, requests);
}

function setupAppointments(user) {
  const container = document.getElementById("appointmentsList");
  if (!container || !user) return;

  const requests = read(DB.requests, []);
  const mine = user.role === "patient"
    ? requests.filter(r => r.patientId === user.id)
    : requests.filter(r => r.studentId === user.id);

  container.replaceChildren();

  if (!mine.length) {
    const empty = document.createElement("p");
    empty.textContent = "No appointments or requests found.";
    container.appendChild(empty);
    return;
  }

  mine.forEach(request => {
    const card = document.createElement("article");
    card.className = "card";

    const heading = document.createElement("h3");
    heading.textContent = request.service;

    const date = document.createElement("p");
    date.textContent = `Date: ${request.date}`;

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = request.status;

    card.append(heading, date, status);
    container.appendChild(card);
  });
}

function setupProfile(user) {
  const form = document.getElementById("profileForm");
  if (!form || !user) return;

  const byId = id => document.getElementById(id);

  byId("profileName").value = user.name || "";
  byId("profileEmail").value = user.email || "";
  byId("profilePhone").value = user.phone || "";
  byId("profileAge").value = user.age || "";

  const patientFields = byId("profilePatientFields");
  const studentFields = byId("profileStudentFields");

  patientFields.hidden = user.role !== "patient";
  studentFields.hidden = user.role !== "student";

  byId("profileLocation").value = user.location || "";
  byId("profileConcern").value = user.concern || "";
  byId("profileUniversity").value = user.university || "";
  byId("profileYear").value = user.year || "First Year";

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const users = read(DB.users, []);
    const index = users.findIndex(item => item.id === user.id);
    if (index < 0) return;

    users[index] = {
      ...users[index],
      name: byId("profileName").value.trim(),
      phone: byId("profilePhone").value.trim(),
      age: Number(byId("profileAge").value),
      location: byId("profileLocation").value.trim(),
      concern: byId("profileConcern").value.trim(),
      university: byId("profileUniversity").value.trim(),
      year: byId("profileYear").value
    };

    write(DB.users, users);
    setMessage("profileMessage", "Profile updated successfully.");
  });
}

function setupLogout() {
  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => {
      localStorage.removeItem(DB.current);
      location.href = "login.html";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupRegistration();
  setupLogin();

  const user = protectPage();
  if (!user) {
    setupLogout();
    return;
  }

  setupWelcome(user);
  setupPatientRequests(user);
  setupProfile(user);
  setupAppointments(user);

  if (user.role === "patient") {
    renderRequests(user, "patientRequests");
  }

  if (user.role === "student") {
    renderRequests(user, "studentRequests");
  }

  setupLogout();
});