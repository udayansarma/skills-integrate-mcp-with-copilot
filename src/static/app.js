document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Authentication elements
  const showLoginBtn = document.getElementById("show-login-btn");
  const loginContainer = document.getElementById("login-container");
  const userInfo = document.getElementById("user-info");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const teacherNameSpan = document.getElementById("teacher-name");

  // Auth state
  let authToken = localStorage.getItem("authToken");
  let isAuthenticated = false;
  let currentTeacher = null;

  // Authentication functions
  async function checkAuthStatus() {
    if (!authToken) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          isAuthenticated = true;
          currentTeacher = data;
          updateAuthUI();
          return;
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }

    // Clear invalid token
    localStorage.removeItem("authToken");
    authToken = null;
    isAuthenticated = false;
    currentTeacher = null;
    updateAuthUI();
  }

  function updateAuthUI() {
    if (isAuthenticated && currentTeacher) {
      userInfo.classList.remove("hidden");
      teacherNameSpan.textContent = `Welcome, ${currentTeacher.teacher_name}`;
      showLoginBtn.textContent = "👤✓";
      showLoginBtn.title = "Logged in as teacher";
    } else {
      userInfo.classList.add("hidden");
      teacherNameSpan.textContent = "Not logged in";
      showLoginBtn.textContent = "👤";
      showLoginBtn.title = "Click to login";
    }
    loginContainer.classList.add("hidden");
  }

  async function login(username, password) {
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
      });

      const data = await response.json();
      
      if (response.ok) {
        authToken = data.token;
        localStorage.setItem("authToken", authToken);
        isAuthenticated = true;
        currentTeacher = data;
        updateAuthUI();
        showMessage("Login successful", "success");
        return true;
      } else {
        showMessage(data.detail || "Login failed", "error");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      showMessage("Login failed", "error");
      return false;
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }

    localStorage.removeItem("authToken");
    authToken = null;
    isAuthenticated = false;
    currentTeacher = null;
    updateAuthUI();
    showMessage("Logged out successfully", "success");
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons for teachers only
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${isAuthenticated ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ''}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    // Check if user is authenticated
    if (!isAuthenticated || !authToken) {
      showMessage("Only teachers can unregister students. Please login first.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Authentication event listeners
  showLoginBtn.addEventListener("click", () => {
    if (isAuthenticated) {
      // If already logged in, show user info or logout
      return;
    }
    
    loginContainer.classList.toggle("hidden");
    if (!loginContainer.classList.contains("hidden")) {
      usernameInput.focus();
    }
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginContainer.classList.add("hidden");
    usernameInput.value = "";
    passwordInput.value = "";
  });

  loginBtn.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
      showMessage("Please enter both username and password", "error");
      return;
    }
    
    const success = await login(username, password);
    if (success) {
      usernameInput.value = "";
      passwordInput.value = "";
      // Refresh activities to show/hide delete buttons
      fetchActivities();
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await logout();
    // Refresh activities to hide delete buttons
    fetchActivities();
  });

  // Handle Enter key in login form
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loginBtn.click();
    }
  });

  usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      passwordInput.focus();
    }
  });

  // Initialize app
  checkAuthStatus();
  fetchActivities();
});
