// orders.js
const apiUrl = "http://localhost:3002/orders";
const pacientesUrl = "http://localhost:5288/api/Pacientes";
let pacientesMap = {};
let testTypes = [];

function getTestName(testTypeId) {
  const test = testTypes.find(t => t.testTypeId === testTypeId);
  return test ? test.name : "Desconocido";
}

function getBadgeColor(status) {
  const map = {
    pendiente: "warning",
    completado: "success",
    cancelado: "danger",
    rechazado: "secondary"
  };
  return map[status?.toLowerCase()] || "info";
}

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
  if (!token) return logout();
  const payload = parseJwt(token);
  if (!payload || !payload.nameid) return logout();
  await cargarTestTypes();
  await cargarPacientes();
  await fetchOrders(parseInt(payload.nameid));
});

async function cargarPacientes() {
  const token = localStorage.getItem("token");
  const res = await axios.get(pacientesUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const select = document.getElementById("patientSelect");
  res.data.forEach(p => {
    const nombre = `${p.first_Name} ${p.last_Name}`;
    pacientesMap[p.patient_Id.toString()] = nombre;
    const opt = document.createElement("option");
    opt.value = p.patient_Id;
    opt.textContent = nombre;
    select.appendChild(opt);
  });
}

async function cargarTestTypes() {
  const token = localStorage.getItem("token");
  const res = await axios.get("http://localhost:3003/api/TestTypes", {
    headers: { Authorization: `Bearer ${token}` }
  });
  testTypes = res.data;
  const select = document.getElementById("testTypeSelect");
  testTypes.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.testTypeId;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

async function fetchOrders(doctorId) {
  const token = localStorage.getItem("token");
  const res = await axios.get(`${apiUrl}/doctor/${doctorId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  mostrarOrdenes(res.data.reverse());
}

function mostrarOrdenes(orders) {
  const container = document.getElementById("ordersContainer");
  container.innerHTML = "";

  if (orders.length === 0) return container.innerHTML = "<p>No se encontraron órdenes.</p>";

  orders.forEach(order => {
    const patientName = pacientesMap[order.patientId.toString()] || `ID ${order.patientId}`;

    const div = document.createElement("div");
    div.classList.add("order-card");

    const notasId = `notas-${order.orderId}`;
    const btnEditarId = `btn-editar-${order.orderId}`;

    div.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <h5>Orden #${order.orderId}</h5>
          <p class="order-meta mb-1">
            <i class="bi bi-person"></i> Paciente: ${patientName} (ID: ${order.patientId})
          </p>
          <p class="order-meta mb-1">
            <i class="bi bi-flask"></i> Test: ${getTestName(order.testTypeId)} (ID ${order.testTypeId})
          </p>
          <p class="order-meta mb-1">
            <i class="bi bi-clock"></i> Fecha: ${new Date(order.orderDate).toLocaleString()}
          </p>
          <span class="badge bg-${getBadgeColor(order.status)} badge-status text-capitalize">${order.status}</span>
          <p class="mt-2"><strong>Notas:</strong>
            <input type="text" id="${notasId}" class="form-control d-inline-block" style="width: auto; max-width: 400px" value="${order.notes || ''}" readonly />
          </p>
        </div>
        <div class="order-actions d-flex flex-column justify-content-start gap-2">
          ${order.status.toLowerCase() === "pendiente" ? `
            <button id="${btnEditarId}" class="btn btn-outline-secondary btn-sm">Editar</button>
            <button class="btn btn-outline-danger btn-sm" onclick='eliminarOrden(${order.orderId}, ${order.doctorId})'>Eliminar</button>
          ` : ''}
          <button class="btn btn-outline-primary btn-sm" onclick='redirigirAResultado(${order.orderId},${order.patientId},${order.testTypeId})'>Registrar Resultado</button>
        </div>
      </div>
    `;
    container.appendChild(div);

    const btnEditar = document.getElementById(btnEditarId);
    if (btnEditar) {
      btnEditar.addEventListener("click", async () => {
        const inputNotas = document.getElementById(notasId);
        if (btnEditar.textContent.trim() === "Editar") {
          inputNotas.removeAttribute("readonly");
          inputNotas.focus();
          btnEditar.textContent = "Guardar";
        } else {
          inputNotas.setAttribute("readonly", "readonly");
          btnEditar.textContent = "Editar";
          await actualizarNotas(order.orderId, order.doctorId, inputNotas.value);
        }
      });
    }
  });
}

async function actualizarNotas(orderId, doctorId, notas) {
  const token = localStorage.getItem("token");
  try {
    await axios.put(`${apiUrl}/${orderId}?doctorId=${doctorId}`, {
      notes: notas
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetchOrders(parseInt(doctorId));
  } catch (err) {
    alert("Error al actualizar las notas.");
    console.error(err);
  }
}

document.getElementById("orderForm").addEventListener("submit", async e => {
  e.preventDefault();
  const token = localStorage.getItem("token");
  const payload = parseJwt(token);
  const doctorId = parseInt(payload.nameid);

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

document.getElementById("filterForm").addEventListener("submit", async e => {
  e.preventDefault();
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const patientId = document.getElementById("filterPatientId").value.trim();
  const testTypeId = document.getElementById("filterTestTypeId").value.trim();

  let endpoint = null;
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
});

function resetFilters() {
  document.getElementById("filterPatientId").value = "";
  document.getElementById("filterTestTypeId").value = "";
  const token = localStorage.getItem("token");
  const payload = parseJwt(token);
  fetchOrders(parseInt(payload.nameid));
}

async function eliminarOrden(orderId, doctorId) {
  const confirmado = confirm(`¿Eliminar la orden #${orderId}?`);
  if (!confirmado) return;
  const token = localStorage.getItem("token");
  await axios.delete(`${apiUrl}/${orderId}?doctorId=${doctorId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  fetchOrders(doctorId);
}

function redirigirAResultado(orderId, patientId, testTypeId) {
  window.location.href = `../results/results.html?orderId=${orderId}&patientId=${patientId}&testTypeId=${testTypeId}`;
}
