const API_URL = "http://localhost:5262/api/testtypes"; // Cambia el puerto si es diferente

const form = document.getElementById("testTypeForm");
const nameInput = document.getElementById("name");
const descInput = document.getElementById("description");
const idInput = document.getElementById("testTypeId");
const tableBody = document.getElementById("testTypesTable");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const testType = {
    name: nameInput.value.trim(),
    description: descInput.value.trim(),
  };

  try {
    if (idInput.value) {
      // Editar
      await axios.put(`${API_URL}/${idInput.value}`, testType);
    } else {
      // Crear
      await axios.post(API_URL, testType);
    }

    resetForm();
    await fetchTestTypes();
  } catch (err) {
    console.error("Error al guardar:", err);
    alert("Error al guardar el tipo de test.");
  }
});

async function fetchTestTypes() {
  try {
    const res = await axios.get(API_URL);
    renderTable(res.data);
  } catch (err) {
    console.error("Error al cargar tipos:", err);
  }
}

function renderTable(types) {
  tableBody.innerHTML = "";

  types.forEach(t => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t.testTypeId}</td>
      <td>${t.name}</td>
      <td>${t.description || "-"}</td>
      <td>${new Date(t.createdAt).toLocaleString()}</td>
      <td>${new Date(t.updatedAt).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm btn-warning me-2" onclick='editTestType(${JSON.stringify(t)})'>
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick='deleteTestType(${t.testTypeId})'>
          <i class="bi bi-trash3-fill"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function editTestType(t) {
  idInput.value = t.testTypeId;
  nameInput.value = t.name;
  descInput.value = t.description || "";
}

async function deleteTestType(id) {
  if (!confirm(`¿Eliminar el tipo de test con ID ${id}?`)) return;

  try {
    await axios.delete(`${API_URL}/${id}`);
    await fetchTestTypes();
  } catch (err) {
    console.error("Error al eliminar:", err);
    alert("No se pudo eliminar.");
  }
}

function resetForm() {
  form.reset();
  idInput.value = "";
}

window.addEventListener("DOMContentLoaded", fetchTestTypes);
