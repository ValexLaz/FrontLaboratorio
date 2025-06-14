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
    const pacientesMap = {};
    pacientes.forEach(p => {
      pacientesMap[p.patient_Id] = `${p.first_Name} ${p.last_Name}`;
    });

    // 4. Doctores (manejo de error si no existe el endpoint)
    let doctoresMap = {};
    try {
      const doctoresRes = await fetch("http://localhost:5288/api/Doctores", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (doctoresRes.ok) {
        const doctores = await doctoresRes.json();
        doctores.forEach(d => {
          doctoresMap[d.doctor_Id] = `${d.first_Name} ${d.last_Name}`;
        });
      }
    } catch {
      // Si falla, deja doctoresMap vacío y se mostrará el ID
    }

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

    // 7. Prepara los datos
    historialFiltrado = resultFields.map(rf => {
      const result = results.find(r => r.resultId === rf.resultId);
      if (!result) return null;
      const paciente = pacientesMap[result.patientId] || result.patientId;
      const testType = testTypesMap[result.testTypeId] || result.testTypeId;
      const field = fieldsMap[rf.fieldId];
      const parametro = field ? field.fieldName : rf.fieldId;
      const valorDefinido = field ? field.referenceRange : "-";
      const unidad = field ? field.unit : "-";
      const valorRegistrado = rf.value;
      const fecha = result.createdAt
        ? new Date(result.createdAt).toLocaleDateString('es-ES')
        : "-";
      const doctor = doctoresMap[result.doctorId] || result.doctorId || "-";
      const comentario = rf.comment || "-";
      return { paciente, doctor, testType, parametro, valorDefinido, valorRegistrado, unidad, fecha, comentario };
    }).filter(Boolean);

    renderHistorialTabla(historialFiltrado);
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
