insert into project_team_members (
  organization_id, project_id, member_type, display_name, project_role,
  responsibility, allocation_percentage, start_date, end_date,
  permission_level, status
)
select
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13'::uuid,
  'a40a7436-c63f-4e3b-94cd-041447ee54d4'::uuid,
  'group_imported',
  v.nombre, v.rol, v.responsabilidad, v.pct, v.inicio::date, v.fin::date,
  'read_only', 'active'
from (values
('Valeria Mendoza','Sponsor Ejecutivo','Patrocina el programa y elimina bloqueos ejecutivos.',15,'2026-01-12','2026-12-09','valeria.mendoza@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Diego Navarro','Project Manager','Integra alcance, cronograma, costo, riesgos y comunicaciones.',100,'2026-01-12','2026-12-09','diego.navarro@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Lucía Herrera','PMO / Control de Proyectos','Mantiene WBS, línea base, dependencias, métricas y reconciliación.',80,'2026-01-12','2026-12-09','lucia.herrera@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Andrés Salazar','Arquitecto de Solución','Asegura diseño de solución coherente y trazable.',80,'2026-01-12','2026-11-20','andres.salazar@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Tomás Beltrán','Arquitecto Empresarial','Alinea SAP con arquitectura empresarial y roadmap.',30,'2026-01-19','2026-10-30','tomas.beltran@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Laura Cárdenas','Líderes Funcionales','Dirigen procesos, configuración y aceptación funcional.',100,'2026-02-23','2026-11-20','laura.cardenas@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Sofía Ramírez','Dueños de Proceso','Aprobar procesos y resultados de negocio.',35,'2026-02-23','2026-11-27','sofia.ramirez@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Javier Peña','Usuarios Clave','Aportan conocimiento operativo y ejecutan validaciones.',50,'2026-03-09','2026-12-04','javier.pena@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Natalia Fuentes','Líder de Migración de Datos','Gobierna objetos, calidad, cargas y reconciliación.',100,'2026-02-02','2026-11-27','natalia.fuentes@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Ricardo Lozano','Líder de Integraciones','Gobierna interfaces, contratos y monitoreo.',100,'2026-02-02','2026-11-27','ricardo.lozano@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Felipe Guzmán','Líder Basis / Técnico','Gestiona landscape, ambientes, transportes y rendimiento.',80,'2026-01-19','2026-12-09','felipe.guzman@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Mariana Ortiz','Líder ABAP / Desarrollo','Gobierna desarrollos, calidad de código y transportes.',100,'2026-03-31','2026-11-20','mariana.ortiz@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Camila Torres','Test Manager','Define estrategia, ciclos, defectos y evidencia.',100,'2026-03-31','2026-11-20','camila.torres@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Gabriela Suárez','Aprobador de Calidad / Gates','Evalúa criterios de gate y recomienda decisión.',25,'2026-01-12','2026-12-09','gabriela.suarez@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)'),
('Elena Castro','Líder de Gestión del Cambio','Dirige impactos, comunicaciones y adopción.',80,'2026-02-02','2026-12-09','elena.castro@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Daniel Rojas','Líder de Formación','Diseña y ejecuta capacitación por rol.',70,'2026-06-01','2026-11-20','daniel.rojas@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Martín Vega','Cutover Manager','Integra runbook, ventana, comandos y rollback.',100,'2026-06-30','2026-11-13','martin.vega@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Sergio Pineda','Líder de Seguridad / Autorizaciones','Gobierna roles, accesos y segregación de funciones.',60,'2026-02-16','2026-11-20','sergio.pineda@nexasphere.example','NexaSphere Consulting (empresa ficticia)'),
('Paula Ríos','Líder de Hypercare','Coordina soporte, KPIs, triage y transición a operación.',100,'2026-08-31','2026-12-09','paula.rios@novamercado.example','NovaMercado Andino S.A. (empresa ficticia)')
) as v(nombre, rol, responsabilidad, pct, inicio, fin, correo, organizacion)
where not exists (
  select 1 from project_team_members m
  where m.project_id = 'a40a7436-c63f-4e3b-94cd-041447ee54d4'::uuid
    and lower(m.display_name) = lower(v.nombre)
    and m.status <> 'removed'
)
returning display_name, project_role, allocation_percentage;