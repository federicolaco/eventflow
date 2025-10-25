#!/bin/bash

echo "Ejecutando pruebas de JMeter en EventFlow..."
echo ""

# Crear directorio de resultados si no existe
mkdir -p jmeter/results

# Limpiar resultados anteriores
rm -rf jmeter/results/*

echo "Iniciando pruebas de carga..."
docker exec eventflow-jmeter sh -c "jmeter -n -t /jmeter/EventFlow-Test-Plan.jmx -l /results/results.jtl -e -o /results/report"

echo ""
echo "Pruebas completadas!"
echo "Reporte HTML generado en: jmeter/results/report/index.html"
echo ""
echo "Para ver el reporte:"
echo "  open jmeter/results/report/index.html"
