// main/results/registrar_resultado.js

const form = document.getElementById('registroResultadoForm');
const msg = document.getElementById('msg');

function showResultToast(message, type = "primary") {
  const toastEl = document.getElementById("resultToast");
  const toastBody = document.getElementById("resultToastBody");
  toastBody.textContent = message;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    const orderId = parseInt(document.getElementById('orderId').value);
    const patientId = parseInt(document.getElementById('patientId').value);
    const testTypeId = parseInt(document.getElementById('testTypeId').value);

    const fieldId = parseInt(document.getElementById('fieldId').value);
    const value = document.getElementById('value').value;
    const comment = document.getElementById('comment').value;

    try {
        // 1. Crear el resultado con status "Finalizado"
        const resultRes = await fetch('http://localhost:5272/api/results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ orderId, patientId, testTypeId, status: "Finalizado" })
        });

        if (!resultRes.ok) {
            const error = await resultRes.text();
            showResultToast("Error creando resultado: " + error, "danger");
            return;
        }

        const resultData = await resultRes.json();
        const resultId = resultData.resultId || resultData.ResultId;

        // 2. Crear el campo de resultado
        const resultFieldRes = await fetch('http://localhost:5175/api/ResultFields', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                resultId,
                testTypeId,
                fieldId,
                value,
                comment
            })
        });

        if (!resultFieldRes.ok) {
            const error = await resultFieldRes.text();
            showResultToast("Error creando campo: " + error, "danger");
            return;
        }

        // 3. Obtener la orden actual para actualizarla
        const orderRes = await fetch(`http://localhost:3002/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!orderRes.ok) {
            const error = await orderRes.text();
            showResultToast("Error obteniendo la orden: " + error, "danger");
            return;
        }

        const orderData = await orderRes.json();

        // 4. Actualizar la orden a "Finalizado" (doctorId como query param)
        const updateOrderDto = {
            orderId: orderData.orderId,
            doctorId: orderData.doctorId,
            patientId: orderData.patientId,
            testTypeId: orderData.testTypeId,
            orderDate: orderData.orderDate,
            status: "Finalizado",
            notes: orderData.notes
        };

        const updateOrderRes = await fetch(
            `http://localhost:3002/orders/${orderId}?doctorId=${orderData.doctorId}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateOrderDto)
            }
        );

        if (!updateOrderRes.ok) {
            const error = await updateOrderRes.text();
            showResultToast("Error actualizando la orden: " + error, "danger");
            return;
        }

        showResultToast("Resultado, campo y orden finalizados correctamente.", "success");
        form.reset();
        setTimeout(() => {
            window.location.href = "../orders/orders.html";
        }, 1200);

    } catch (err) {
        showResultToast("Error de red: " + err.message, "danger");
    }
});

// Obtén los parámetros de la URL
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get('orderId'),
    patientId: params.get('patientId'),
    testTypeId: params.get('testTypeId')
  };
}

async function getPatientName(patientId) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`http://localhost:5288/api/Pacientes/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return `ID ${patientId}`;
    const data = await res.json();
    return `${data.first_Name} ${data.last_Name}`;
  } catch {
    return `ID ${patientId}`;
  }
}

async function getTestTypeName(testTypeId) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`http://localhost:3003/api/TestTypes/${testTypeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return `ID ${testTypeId}`;
    const data = await res.json();
    return data.name || `ID ${testTypeId}`;
  } catch {
    return `ID ${testTypeId}`;
  }
}

async function getFieldsByTestType(testTypeId) {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://localhost:5141/api/Fields/${testTypeId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  return await res.json();
}

async function renderFieldRow(field) {
  const container = document.getElementById("fieldsContainer");
  container.innerHTML = `
    <tr>
      <td>
        <strong>${field.fieldName}</strong>
        <input type="hidden" id="fieldId" name="fieldId" value="${field.fieldId}">
      </td>
      <td>
        <input type="number" class="form-control" id="value" name="value" placeholder="Valor" step="0.01" required>
      </td>
      <td>
        <span>${field.referenceRange}</span>
      </td>
      <td>
        <span>${field.unit}</span>
      </td>
    </tr>
    <tr>
      <td colspan="4">
        <input type="text" class="form-control" id="comment" name="comment" placeholder="Comentario">
      </td>
    </tr>
  `;
}

async function getOrderStatus(orderId) {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://localhost:3002/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status;
}

window.addEventListener('DOMContentLoaded', async () => {
  const { orderId, patientId, testTypeId } = getQueryParams();
  if (orderId) document.getElementById('orderId').value = orderId;
  if (patientId) document.getElementById('patientId').value = patientId;
  if (testTypeId) document.getElementById('testTypeId').value = testTypeId;

  // Verifica el estado de la orden antes de permitir registrar resultado
  if (orderId) {
    const status = await getOrderStatus(orderId);
    if (status && status.toLowerCase() === "finalizado") {
      showResultToast("Esta orden ya está finalizada. No se puede registrar otro resultado.", "warning");
      // Deshabilita el formulario
      document.getElementById('registroResultadoForm').querySelectorAll("input, button, select, textarea").forEach(el => el.disabled = true);
      return;
    }
  }

  // Mostrar nombres en los campos de solo lectura
  if (patientId) document.getElementById('patientName').value = await getPatientName(patientId);
  if (testTypeId) document.getElementById('testTypeName').value = await getTestTypeName(testTypeId);

  // Renderiza el único field del testType
  if (testTypeId) {
    const fields = await getFieldsByTestType(testTypeId);
    if (fields.length > 0) {
      await renderFieldRow(fields[0]);
    }
  }
});
