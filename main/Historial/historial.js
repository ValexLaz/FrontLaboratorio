let historialFiltrado = [];

function renderHistorialTabla(data) {
  const tbody = document.getElementById("historialBody");
  tbody.innerHTML = "";
  data.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.paciente}</td>
      <td>${row.doctor}</td>
      <td>${row.testType}</td>
      <td>${row.parametro}</td>
      <td>${row.valorDefinido}</td>
      <td>${row.valorRegistrado}</td>
      <td>${row.unidad}</td>
      <td>${row.fecha}</td>
      <td>
        <button class="btn btn-outline-danger btn-sm" onclick="descargarPDF(${idx})">
          <i class="bi bi-file-earmark-pdf"></i> PDF
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function getDoctorName(doctorId, token) {
  if (!doctorId) return "No asignado";
  try {
    const res = await fetch(`http://localhost:3000/api/user/${doctorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return doctorId;
    const data = await res.json();
    return data.name || doctorId;
  } catch {
    return doctorId;
  }
}

async function fetchHistorial() {
  const token = localStorage.getItem("token");
  try {
    // 1. Resultados
    const resultsRes = await fetch("http://localhost:5272/api/results", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const results = await resultsRes.json();

    // 2. Campos de resultados
    const resultFieldsRes = await fetch("http://localhost:5175/api/ResultFields", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const resultFields = await resultFieldsRes.json();

    // 3. Pacientes
    const pacientesRes = await fetch("http://localhost:5288/api/Pacientes", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const pacientes = await pacientesRes.json();


    // 5. Tipos de test
    const testTypesRes = await fetch("http://localhost:3003/api/TestTypes", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const testTypes = await testTypesRes.json();
    const testTypesMap = {};
    testTypes.forEach(t => {
      testTypesMap[t.testTypeId] = t.name;
    });

    // 6. Fields
    const fieldsRes = await fetch("http://localhost:5141/api/Fields", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const fields = await fieldsRes.json();
    const fieldsMap = {};
    fields.forEach(f => {
      fieldsMap[f.fieldId] = f;
    });

    // Mapea pacientes con su doctor_Id y nombre
    const pacientesMap = {};
    pacientes.forEach(p => {
      pacientesMap[p.patient_Id] = {
        nombre: `${p.first_Name} ${p.last_Name}`,
        doctorId: p.doctor_Id
      };
    });

    historialFiltrado = (await Promise.all(resultFields.map(async rf => {
  const result = results.find(r => r.resultId === rf.resultId);
  if (!result) return null;

  const pacienteObj = pacientesMap[result.patientId];
  const paciente = pacienteObj ? pacienteObj.nombre : null; // <-- podría quedar null
  const doctorId = pacienteObj ? pacienteObj.doctorId : null;

  let doctor = "No asignado";
  if (doctorId) {
    doctor = await getDoctorName(doctorId, token);
  }

  const testType = testTypesMap[result.testTypeId] || result.testTypeId;
  const field = fieldsMap[rf.fieldId];
  const parametro = field ? field.fieldName : rf.fieldId;
  const valorDefinido = field ? field.referenceRange : "-";
  const unidad = field ? field.unit : "-";
  const valorRegistrado = rf.value;
  const fecha = result.createdAt
    ? new Date(result.createdAt).toLocaleDateString('es-ES')
    : "-";
  const comentario = rf.comment || "-";

  if (!paciente) return null;

  return {
    paciente, doctor, testType, parametro, valorDefinido,
    valorRegistrado, unidad, fecha, comentario,
    orderId: result.orderId,
    patientId: result.patientId
  };
}))).filter(Boolean); // 👈 esto asegura que no haya nulls


    renderHistorialTabla(historialFiltrado.filter(Boolean));
  } catch (err) {
    alert("Error al cargar el historial. Verifica que todos los servicios estén activos.");
  }
}

function descargarPDF(idx) {
  const row = historialFiltrado[idx];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Resultado de Laboratorio", 14, 18);

  doc.setFontSize(12);
  doc.text(`Paciente: ${row.paciente}`, 14, 30);
  doc.text(`Doctor: ${row.doctor}`, 14, 38);
  doc.text(`Tipo de Test: ${row.testType}`, 14, 46);
  doc.text(`Fecha: ${row.fecha}`, 14, 54);

  doc.autoTable({
    startY: 62,
    head: [['Parámetro', 'Valor Definido', 'Valor Registrado', 'Unidad']],
    body: [
      [row.parametro, row.valorDefinido, row.valorRegistrado, row.unidad]
    ],
    theme: 'grid'
  });

  // Agrega el comentario del doctor debajo de la tabla
  let finalY = doc.lastAutoTable.finalY || 72;
  doc.setFontSize(12);
  doc.text(`Comentario del doctor: ${row.comentario}`, 14, finalY + 10);

  doc.save(`Resultado_${row.paciente.replace(/\s+/g, '_')}_${row.parametro.replace(/\s+/g, '_')}.pdf`);
}

window.addEventListener("DOMContentLoaded", () => {
  fetchHistorial();

  document.getElementById("buscadorPaciente").addEventListener("input", function() {
    const texto = this.value.trim().toLowerCase();
    const filtrados = historialFiltrado.filter(row =>
      row.paciente.toLowerCase().includes(texto)
    );
    renderHistorialTabla(filtrados);
  });
});
  document.getElementById("buscadorOrden").addEventListener("input", function () {
    const valor = this.value.trim();
    const filtrados = historialFiltrado.filter(row =>
      row.orderId?.toString().includes(valor)
    );
    renderHistorialTabla(filtrados);
  });

  document.getElementById("buscadorPacienteId").addEventListener("input", function () {
    const valor = this.value.trim();
    const filtrados = historialFiltrado.filter(row =>
      row.patientId?.toString().includes(valor)
    );
    renderHistorialTabla(filtrados);
  });
