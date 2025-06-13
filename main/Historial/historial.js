async function fetchHistorial() {
  const token = localStorage.getItem("token");
  // 1. Trae todos los resultados
  const resultsRes = await fetch("http://localhost:5272/api/results", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const results = await resultsRes.json();

  // 2. Trae todos los campos de resultados
  const resultFieldsRes = await fetch("http://localhost:5175/api/ResultFields", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const resultFields = await resultFieldsRes.json();

  // 3. Trae todos los pacientes
  const pacientesRes = await fetch("http://localhost:5288/api/Pacientes", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const pacientes = await pacientesRes.json();
  const pacientesMap = {};
  pacientes.forEach(p => {
    pacientesMap[p.patient_Id] = `${p.first_Name} ${p.last_Name}`;
  });

  // 4. Trae todos los doctores (si tienes endpoint, si no, omite)
  // Suponiendo que el doctor está en el resultado como doctorId
  // Si necesitas traer los nombres de doctores, agrega aquí la lógica

  // 5. Trae todos los tipos de test
  const testTypesRes = await fetch("http://localhost:5262/api/TestTypes", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const testTypes = await testTypesRes.json();
  const testTypesMap = {};
  testTypes.forEach(t => {
    testTypesMap[t.testTypeId] = t.name;
  });

  // 6. Trae todos los fields
  const fieldsRes = await fetch("http://localhost:5141/api/Fields", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const fields = await fieldsRes.json();
  const fieldsMap = {};
  fields.forEach(f => {
    fieldsMap[f.fieldId] = f;
  });

  // 7. Renderiza la tabla
  const tbody = document.getElementById("historialBody");
  tbody.innerHTML = "";

  resultFields.forEach(rf => {
    const result = results.find(r => r.resultId === rf.resultId);
    if (!result) return;

    const paciente = pacientesMap[result.patientId] || result.patientId;
    const testType = testTypesMap[result.testTypeId] || result.testTypeId;
    const field = fieldsMap[rf.fieldId];
    const parametro = field ? field.fieldName : rf.fieldId;
    const valorDefinido = field ? field.referenceRange : "-";
    const unidad = field ? field.unit : "-";
    const valorRegistrado = rf.value;
    const fecha = result.createdAt ? new Date(result.createdAt).toLocaleString() : "-";
    const doctor = result.doctorId || "-"; // Si tienes endpoint de doctores, puedes mapear el nombre

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${paciente}</td>
      <td>${doctor}</td>
      <td>${testType}</td>
      <td>${parametro}</td>
      <td>${valorDefinido}</td>
      <td>${valorRegistrado}</td>
      <td>${unidad}</td>
      <td>${fecha}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.addEventListener("DOMContentLoaded", fetchHistorial);
