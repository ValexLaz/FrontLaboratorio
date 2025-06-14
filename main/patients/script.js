const baseUrl = "http://localhost:5288/api/Pacientes";

let editMode = false;
let editingPatientId = null;
let patients = [];

const form = document.getElementById("patientForm");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const searchInput = document.getElementById("searchInput");
const tableBody = document.querySelector("#patientsTable tbody");

document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticación
  const token = localStorage.getItem("token");

  if (!token) {
    // No hay token, redirigir a login
    window.location.href = "../auth/signIn.html"; // Ajusta la ruta a tu login
    return;
  }

  try {
    // Verificar token en backend
    await axios.get("http://localhost:3000/api/auth/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    // Token inválido o expirado, redirigir a login
    localStorage.removeItem("token");
    window.location.href = "../auth/signIn.html"; // Ajusta la ruta a tu login
    return;
  }

  // Si pasa la verificación, continua con la lógica normal

  document.getElementById("dob").max = new Date().toISOString().split("T")[0];
  await fetchPatients();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    // Obtén el id del doctor desde localStorage con la clave correcta
    const doctorIdRaw = localStorage.getItem("userId");
    console.log("Valor recuperado de localStorage userId:", doctorIdRaw);
    const doctorId = Number(doctorIdRaw);
    if (!doctorId || isNaN(doctorId)) {
      alert("No se pudo obtener el ID del doctor. Por favor, vuelve a iniciar sesión.");
      return;

    }

    const data = {
      patient_Id: editingPatientId,
      first_Name: document.getElementById("firstName").value.trim(),
      last_Name: document.getElementById("lastName").value.trim(),
      date_Of_Birth: document.getElementById("dob").value,
      gender: document.getElementById("gender").value,
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim() || null,
      doctor_Id: doctorId, // Aquí va el id correcto
    };

    console.log(data); // <-- Agrega esto antes del axios.post

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (editMode) {
        await axios.put(`${baseUrl}/${editingPatientId}`, data, config);
      } else {
        await axios.post(baseUrl, data, config);
      }

      bootstrap.Toast.getOrCreateInstance(document.getElementById("successToast")).show();
      resetForm();
      fetchPatients();
    } catch (error) {
      console.error(error);
      bootstrap.Toast.getOrCreateInstance(document.getElementById("errorToast")).show();
    }
  });

  cancelEditBtn.addEventListener("click", () => {
    resetForm();
  });

  searchInput.addEventListener("input", async () => {
    const filter = searchInput.value.trim().toLowerCase();

    if (filter === "") {
      renderPatients(patients);
      return;
    }

    if (/^\d+$/.test(filter)) {
      const filteredById = patients.filter((p) =>
        p.patient_Id.toString().includes(filter)
      );

      if (filteredById.length > 0) {
        renderPatients(filteredById);
      } else {
        try {
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const response = await axios.get(`${baseUrl}/${filter}`, config);
          renderPatients([response.data]);
        } catch (error) {
          tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No se encontró paciente con ID ${filter}</td></tr>`;
        }
      }
    } else {
      const filtered = patients.filter(
        (p) =>
          p.first_Name.toLowerCase().includes(filter) ||
          p.last_Name.toLowerCase().includes(filter)
      );

      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No se encontraron pacientes con ese nombre</td></tr>`;
      } else {
        renderPatients(filtered);
      }
    }
  });
});

async function fetchPatients() {
  try {
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await axios.get(baseUrl, config);
    patients = response.data;
    renderPatients(patients);
  } catch (error) {
    console.error("Error al cargar pacientes:", error);
  }
}

function renderPatients(patientList) {
  const container = document.getElementById("patientsContainer");
  container.innerHTML = "";

  if (patientList.length === 0) {
    container.innerHTML = `<p class="text-center">No hay pacientes registrados.</p>`;
    return;
  }

  patientList.slice().reverse().forEach((p) => {
    const card = document.createElement("div");
    card.className = "order-card animate-fade-in";

    card.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <h5 class="text-primary fw-semibold">${p.first_Name} ${p.last_Name}</h5>
          <p class="order-meta mb-1"><i class="bi bi-hash"></i> ID: ${p.patient_Id}</p>
          <p class="order-meta mb-1"><i class="bi bi-calendar3"></i> Fecha Nac.: ${new Date(p.date_Of_Birth).toLocaleDateString("es-ES")}</p>
          <p class="order-meta mb-1"><i class="bi bi-gender-ambiguous"></i> Género: ${p.gender}</p>
          <p class="order-meta mb-1"><i class="bi bi-envelope-at"></i> ${p.email}</p>
          <p class="order-meta mb-0"><i class="bi bi-telephone"></i> ${p.phone ?? "-"}</p>
        </div>
        <div class="order-actions d-flex flex-column justify-content-start gap-2">
          <button class="btn btn-outline-secondary btn-sm" title="Editar">
            <i class="bi bi-pencil-fill"></i> Editar
          </button>
          <button class="btn btn-outline-danger btn-sm" title="Eliminar">
            <i class="bi bi-trash-fill"></i> Eliminar
          </button>
        </div>
      </div>
    `;

    const editBtn = card.querySelector(".btn-outline-secondary");
    const deleteBtn = card.querySelector(".btn-outline-danger");

    editBtn.addEventListener("click", () => {
      startEditing(p);
    });

    deleteBtn.addEventListener("click", () => {
      deletePatient(p.patient_Id);
    });

    container.appendChild(card);
  });
}




function startEditing(patient) {
  editMode = true;
  editingPatientId = patient.patient_Id;

  document.getElementById("firstName").value = patient.first_Name;
  document.getElementById("lastName").value = patient.last_Name;
  document.getElementById("dob").value = patient.date_Of_Birth.split("T")[0];
  document.getElementById("gender").value = patient.gender;
  document.getElementById("email").value = patient.email;
  document.getElementById("phone").value = patient.phone ?? "";

  submitBtn.classList.remove("btn-success");
  submitBtn.classList.add("btn-warning");
  submitBtn.innerHTML = `<i class="bi bi-pencil-square"></i> Guardar cambios`;

  cancelEditBtn.classList.remove("d-none");
  form.classList.remove("was-validated");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editMode = false;
  editingPatientId = null;
  form.reset();
  form.classList.remove("was-validated");
  submitBtn.classList.remove("btn-warning");
  submitBtn.classList.add("btn-success");
  submitBtn.innerHTML = `<i class="bi bi-person-plus-fill"></i> Registrar paciente`;
  cancelEditBtn.classList.add("d-none");
}

async function deletePatient(id) {
  if (!confirm("¿Estás seguro que deseas eliminar este paciente?")) return;

  try {
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    await axios.delete(`${baseUrl}/${id}`, config);
    bootstrap.Toast.getOrCreateInstance(document.getElementById("successToast")).show();

    if (editMode && editingPatientId === id) {
      resetForm();
    }

    fetchPatients();
  } catch (error) {
    console.error(error);
    bootstrap.Toast.getOrCreateInstance(document.getElementById("errorToast")).show();
  }
}
