const apiUrl = "http://localhost:3002/orders";
const pacientesUrl = "http://localhost:5288/api/Pacientes";
let pacientesMap = {};
let testTypes = [];

function logout() {
  localStorage.removeItem("token");
  window.location.href = "../../auth/signIn.html";
}

function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  console.log("Token JWT:", token);

  if (!token) {
    window.location.href = "../../auth/signIn.html";
    return;
  }

  const payload = parseJwt(token);
  console.log("Payload JWT:", payload);

  if (!payload || !payload["nameid"]) {
    logout();
    return;
  }
  await cargarTestTypes();
  await cargarPacientes();
   await fetchOrders(parseInt(payload["nameid"]));
});

async function cargarPacientes() {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get(pacientesUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const select = document.getElementById("patientSelect");
    res.data.forEach(p => {
      const nombreCompleto = `${p.first_Name} ${p.last_Name}`;
      pacientesMap[p.patient_Id.toString()] = nombreCompleto;

      const option = document.createElement("option");
      option.value = p.patient_Id;
      option.textContent = nombreCompleto;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar pacientes:", error);
    alert("No se pudieron cargar los pacientes.");
  }
}
async function cargarTestTypes() {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get("http://localhost:3003/api/testtypes", {
      headers: { Authorization: `Bearer ${token}` }
    });

    testTypes = res.data;

    const select = document.getElementById("testTypeSelect");
    res.data.forEach(t => {
      const option = document.createElement("option");
      option.value = t.testTypeId;
      option.textContent = t.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tipos de test:", error);
    alert("No se pudieron cargar los tipos de test.");
  }
}

async function fetchOrders(doctorId) {
  try {
    const res = await axios.get(`${apiUrl}/doctor/${doctorId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    mostrarOrdenes(res.data);
  } catch (error) {
    console.error("Error al obtener órdenes:", error);
    document.getElementById("ordersContainer").innerHTML =
      `<div class="alert alert-danger">No se pudieron cargar las órdenes.</div>`;
  }
}

function mostrarOrdenes(orders) {
  const container = document.getElementById("ordersContainer");
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = "<p>No se encontraron órdenes.</p>";
    return;
  }

  orders.forEach(order => {
    const patientIdStr = order.patientId.toString();
    const patientName = pacientesMap[patientIdStr] || `ID ${order.patientId}`;

    const div = document.createElement("div");
    div.classList.add("order-card");
    div.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <h5>Orden #${order.orderId}</h5>
          <p class="order-meta mb-1">
            <i class="bi bi-person"></i> Paciente: ${patientName} 
            <span class="text-muted">(ID: ${order.patientId})</span>
            </p>

          <p class="order-meta mb-1">
            <i class="bi bi-flask"></i> Test: ${getTestName(order.testTypeId)} (ID ${order.testTypeId})
            </p>

          <p class="order-meta mb-1"><i class="bi bi-clock"></i> Fecha: ${new Date(order.orderDate).toLocaleString()}</p>
          <span class="badge bg-${getBadgeColor(order.status)} badge-status text-capitalize">${order.status}</span>
          <p class="mt-2"><strong>Notas:</strong> ${order.notes || "Sin notas"}</p>
        </div>
        <div class="order-actions d-flex flex-column justify-content-start gap-2">
          <button class="btn btn-outline-secondary btn-sm" onclick='abrirModalEditarOrden(${JSON.stringify(order)})'>
            <i class="bi bi-pencil-square"></i> Editar
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick='eliminarOrden(${order.orderId}, ${order.doctorId})'>
            <i class="bi bi-trash3"></i> Eliminar
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = localStorage.getItem("token");
  const payload = parseJwt(token);
  const doctorId = parseInt(payload["nameid"]);

  const order = {
    doctorId,
    patientId: parseInt(document.getElementById("patientSelect").value),
    testTypeId: parseInt(document.getElementById("testTypeSelect").value),

    notes: document.getElementById("notes").value
  };

  try {
    await axios.post(apiUrl, order, {
      headers: { Authorization: `Bearer ${token}` }
    });
    document.getElementById("orderForm").reset();
    await fetchOrders(doctorId);
  } catch (err) {
    alert("Error al crear la orden.");
    console.error(err);
  }
});

document.getElementById("filterForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const patientId = document.getElementById("filterPatientId").value.trim();
  const testTypeId = document.getElementById("filterTestTypeId").value.trim();

  let endpoint = null;

  try {
    if (patientId && testTypeId) {
      endpoint = `${apiUrl}/patient/${patientId}/type/${testTypeId}`;
    } else if (patientId) {
      endpoint = `${apiUrl}/patient/${patientId}`;
    } else if (testTypeId) {
      endpoint = `${apiUrl}/test-type/${testTypeId}`;
    } else {
      alert("Debes ingresar al menos un filtro.");
      return;
    }

    const res = await axios.get(endpoint, { headers });
    mostrarOrdenes(res.data);
  } catch (err) {
    console.error("Error al filtrar órdenes:", err);
    document.getElementById("ordersContainer").innerHTML =
      `<div class="alert alert-danger">No se pudieron obtener las órdenes filtradas.</div>`;
  }
});

function resetFilters() {
  document.getElementById("filterPatientId").value = "";
  document.getElementById("filterTestTypeId").value = "";

  const token = localStorage.getItem("token");
  const payload = parseJwt(token);
  fetchOrders(parseInt(payload["nameid"]));
}

function abrirModalEditarOrden(order) {
  document.getElementById("editOrderId").value = order.orderId;
  document.getElementById("editDoctorId").value = order.doctorId;
  document.getElementById("editStatus").value = order.status;
  document.getElementById("editNotes").value = order.notes;

  const modal = new bootstrap.Modal(document.getElementById("editOrderModal"));
  modal.show();
}
function getTestName(testTypeId) {
  const test = testTypes.find(t => t.testTypeId === testTypeId);
  return test ? test.name : "Desconocido";
}


async function eliminarOrden(orderId, doctorId) {
  const confirmado = confirm(`¿Seguro que deseas eliminar la orden #${orderId}?`);
  if (!confirmado) return;

  const token = localStorage.getItem("token");

  try {
    await axios.delete(`${apiUrl}/${orderId}?doctorId=${doctorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    alert("Orden eliminada correctamente.");
    fetchOrders(doctorId);
  } catch (error) {
    console.error("Error al eliminar la orden:", error);
    alert("Hubo un error al intentar eliminar la orden.");
  }
}

document.getElementById("editOrderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = localStorage.getItem("token");

  const orderId = document.getElementById("editOrderId").value;
  const doctorId = document.getElementById("editDoctorId").value;
  const status = document.getElementById("editStatus").value;
  const notes = document.getElementById("editNotes").value;

  try {
    await axios.put(`${apiUrl}/${orderId}?doctorId=${doctorId}`, {
      status,
      notes
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const modal = bootstrap.Modal.getInstance(document.getElementById("editOrderModal"));
    modal.hide();

    fetchOrders(parseInt(doctorId));
  } catch (err) {
    alert("Error al actualizar la orden.");
    console.error(err);
  }
});

function getBadgeColor(status) {
  const map = {
    pendiente: "warning",
    completado: "success",
    cancelado: "danger",
    rechazado: "secondary"
  };
  return map[status?.toLowerCase()] || "info";
}
