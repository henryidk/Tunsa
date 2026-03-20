"""
Genera diagramas de actividad en XML para draw.io
Proyecto Tunsa — Sistema de Gestión de Rentas
"""
import os

BASE = "/home/henryo/Escritorio/Proyecto_Tunsa/diagramas/actividades"
os.makedirs(BASE, exist_ok=True)

# ─── ID counter ────────────────────────────────────────────────────────────────
_id = [9]
def nid():
    _id[0] += 1
    return str(_id[0])

def reset():
    _id[0] = 9

# ─── Styles ────────────────────────────────────────────────────────────────────
ACT  = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=0;fontSize=11;"
DEC  = "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;"
ERR  = "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=11;"
ALT  = "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;"
STA  = "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;"
END  = "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;strokeWidth=5;"
EDG  = "edgeStyle=orthogonalEdgeStyle;html=1;fontSize=10;"
TIT  = "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontStyle=1;fontSize=14;"
NOTE = "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;size=15;fillColor=#fff9c4;strokeColor=#d6b656;fontSize=10;"
BAR  = "fillColor=#000000;strokeColor=#000000;"   # fork/join bar
HDR  = "swimlane;fontStyle=1;fontSize=12;fillColor=#f0f0f0;strokeColor=#666666;"

# ─── Layout constants ──────────────────────────────────────────────────────────
CX  = 570     # center x  main flow
AW, AH = 240, 50
DW, DH = 190, 80
SW  = 30
RX  = 840     # right branch x
LX  = 60      # left  branch x
BW  = 190     # branch box width

# ─── Node builders ─────────────────────────────────────────────────────────────
def _v(label, style, x, y, w, h):
    i = nid()
    lbl = (label.replace('&','&amp;').replace('"','&quot;')
                .replace('<','&lt;').replace('>','&gt;'))
    return i, f'    <mxCell id="{i}" value="{lbl}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def _e(src, tgt, label=""):
    i = nid()
    lbl = label.replace('&','&amp;').replace('"','&quot;')
    return i, f'    <mxCell id="{i}" value="{lbl}" style="{EDG}" edge="1" source="{src}" target="{tgt}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'

def title(l):        return _v(l, TIT, 80, 10, 1000, 30)
def start(y=55):     return _v("", STA, CX-SW//2, y, SW, SW)
def end_(y, cx=CX):  return _v("", END, cx-SW//2, y, SW, SW)
def act(l,y,x=None,w=AW,h=AH,s=ACT): x=x if x is not None else CX-AW//2; return _v(l,s,x,y,w,h)
def dec(l,y,x=None): x=x if x is not None else CX-DW//2; return _v(l,DEC,x,y,DW,DH)
def err(l,y,x=None,w=None,h=AH): x=x if x is not None else RX; w=w if w is not None else BW; return _v(l,ERR,x,y,w,h)
def alt(l,y,x=None,w=None,h=AH,s=ALT): x=x if x is not None else LX; w=w if w is not None else BW; return _v(l,s,x,y,w,h)
def note(l,x,y,w=170,h=55): return _v(l,NOTE,x,y,w,h)
def bar(x,y,w=240,h=8):     return _v("",BAR,x,y,w,h)
def end_r(y): return end_(y, CX + (RX+BW//2-CX))  # end node aligned to right branch
def end_l(y): return end_(y, LX+BW//2)

def arr(src,tgt,lbl=""): return _e(src,tgt,lbl)

# ─── File writer ───────────────────────────────────────────────────────────────
def save(fname, *elements):
    """Pass node/edge tuples; each is (id, xml_string)."""
    lines = [xml for _, xml in elements]
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
{chr(10).join(lines)}
  </root>
</mxGraphModel>'''
    path = os.path.join(BASE, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(xml)
    print(f"  ✓ {fname}")

# ══════════════════════════════════════════════════════════════════════════════
#  DA-01 — Iniciar Sesión (CU-01)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-01 — Iniciar Sesión (CU-01)")
s  = start(55)
a1 = act("Accede a la pantalla de login", 110)
a2 = act("Ingresa nombre de usuario y contraseña", 180)
d1 = dec("¿Usuario activo?", 255)
r1 = err("Mostrar mensaje:\ncuenta desactivada", 265)
x1 = end_(330, CX + (RX+BW//2 - CX))
d2 = dec("¿Credenciales válidas?", 365)
r2 = err("Mostrar error\nRegistrar LOGIN_FAILED", 375)
d3 = dec("¿Demasiados intentos?", 460)
r3 = err("Bloquear IP\ntemporalmente", 470)
x2 = end_(535, CX + (RX+BW//2 - CX))
a3 = act("Generar accessToken (15 min)\ny refreshToken (7 días)", 580, h=60)
a4 = act("Registrar LOGIN_SUCCESS en AuditLog", 660)
d4 = dec("¿mustChangePassword = true?", 735)
a5 = act("Redirigir a CU-03:\nCambiar contraseña forzada", 820, s=ALT)
a6 = alt("Redirigir al dashboard\nsegún rol del usuario", 820)
en = end_(890)

save("DA-01_Login.xml",
    t, s, a1, a2, d1, r1, x1, d2, r2, d3, r3, x2, a3, a4, d4, a5, a6, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],x1[0]),
    arr(d1[0],d2[0],"Sí"), arr(d2[0],r2[0],"No"),
    arr(r2[0],d3[0]),
    arr(d3[0],r3[0],"Sí"), arr(r3[0],x2[0]),
    arr(d3[0],d2[0],"No"),
    arr(d2[0],a3[0],"Sí"), arr(a3[0],a4[0]), arr(a4[0],d4[0]),
    arr(d4[0],a5[0],"Sí"), arr(d4[0],a6[0],"No"),
    arr(a5[0],en[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-02 — Cerrar Sesión (CU-02)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-02 — Cerrar Sesión (CU-02)")
s  = start(55)
a1 = act("El usuario hace clic en\n\"Cerrar sesión\"", 110)
d1 = dec("¿Conexión disponible?", 185)
a2 = act("Revocar todos los refreshTokens\nactivos en la base de datos", 295)
a3 = act("Eliminar cookie httpOnly del refreshToken", 365)
r1 = err("Cerrar sesión localmente\n(sin revocar en servidor)", 200)
a4 = act("Limpiar estado en el store (Zustand)", 435)
a5 = act("Registrar LOGOUT en AuditLog", 505)
a6 = act("Redirigir a la pantalla de login", 575)
en = end_(645)

save("DA-02_Logout.xml",
    t, s, a1, d1, a2, a3, r1, a4, a5, a6, en,
    arr(s[0],a1[0]), arr(a1[0],d1[0]),
    arr(d1[0],a2[0],"Sí"), arr(d1[0],r1[0],"No"),
    arr(a2[0],a3[0]), arr(a3[0],a4[0]),
    arr(r1[0],a4[0]),
    arr(a4[0],a5[0]), arr(a5[0],a6[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-03 — Cambiar Contraseña Forzada (CU-03)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-03 — Cambiar Contraseña Forzada (CU-03)")
s  = start(55)
a1 = act("Sistema detecta mustChangePassword = true\ntras el inicio de sesión (CU-01)", 110, h=60)
a2 = act("Muestra modal CambiarPasswordModal", 195)
a3 = act("Usuario ingresa nueva contraseña\ny su confirmación", 265)
d1 = dec("¿Contraseñas coinciden?", 340)
r1 = err("Mostrar error de\nvalidación", 350)
d2 = dec("¿Igual a la contraseña actual?", 450)
r2 = err("Mostrar error:\nno puede reutizarla", 460)
a4 = act("Actualizar contraseña con hash bcrypt", 555)
a5 = act("Establecer mustChangePassword = false", 625)
a6 = act("Redirigir al dashboard\nsegún rol del usuario", 695, s=ALT)
en = end_(765)

save("DA-03_Cambiar_Password_Forzada.xml",
    t, s, a1, a2, a3, d1, r1, d2, r2, a4, a5, a6, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],a3[0]),
    arr(d1[0],d2[0],"Sí"),
    arr(d2[0],r2[0],"Sí"), arr(r2[0],a3[0]),
    arr(d2[0],a4[0],"No"),
    arr(a4[0],a5[0]), arr(a5[0],a6[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-04 — Crear Usuario (CU-04)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-04 — Crear Usuario (CU-04)")
s  = start(55)
a1 = act("Administrador accede a\nsección Usuarios", 110)
a2 = act("Clic en \"Agregar usuario\"", 180)
a3 = act("Sistema muestra AgregarUsuarioModal", 250)
a4 = act("Completa: nombre, username,\nteléfono (opcional), rol", 320)
d1 = dec("¿Campos válidos?", 395)
r1 = err("Mostrar validaciones\npor campo", 405)
d2 = dec("¿Username duplicado?", 500)
r2 = err("Mostrar error:\nusuario ya existe", 510)
a5 = act("Sistema genera contraseña\nsegura de 8 caracteres", 600)
a6 = act("Crear usuario con\nmustChangePassword=true, isActive=true", 670, h=60)
a7 = act("Modal muestra contraseña\ntemporal para copiar", 752)
a8 = act("Mostrar toast de éxito\ny actualizar tabla", 822)
en = end_(892)

save("DA-04_Crear_Usuario.xml",
    t, s, a1, a2, a3, a4, d1, r1, d2, r2, a5, a6, a7, a8, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],a4[0]),
    arr(a4[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],a4[0]),
    arr(d1[0],d2[0],"Sí"),
    arr(d2[0],r2[0],"Sí"), arr(r2[0],a4[0]),
    arr(d2[0],a5[0],"No"),
    arr(a5[0],a6[0]), arr(a6[0],a7[0]), arr(a7[0],a8[0]), arr(a8[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-05 — Editar Usuario (CU-05)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-05 — Editar Usuario (CU-05)")
s  = start(55)
a1 = act("Administrador localiza el\nusuario en la tabla", 110)
a2 = act("Clic en \"Editar\"", 180)
a3 = act("Sistema muestra EditarUsuarioModal\ncon datos actuales", 250)
a4 = act("Modifica: nombre, username y/o teléfono", 320)
d1 = dec("¿Username ya en uso?", 395)
r1 = err("Mostrar error de\nunicidad", 405)
a5 = act("Sistema valida y actualiza el registro", 490)
a6 = act("Mostrar toast de éxito\ny refrescar tabla", 560)
en = end_(630)

save("DA-05_Editar_Usuario.xml",
    t, s, a1, a2, a3, a4, d1, r1, a5, a6, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]),
    arr(a3[0],a4[0]), arr(a4[0],d1[0]),
    arr(d1[0],r1[0],"Sí"), arr(r1[0],a4[0]),
    arr(d1[0],a5[0],"No"), arr(a5[0],a6[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-06 — Activar / Desactivar Usuario (CU-06, CU-07)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-06 — Activar / Desactivar Usuario (CU-06 y CU-07)")
s  = start(55)
a1 = act("Administrador localiza al\nusuario en la tabla", 110)
d1 = dec("¿Estado actual\ndel usuario?", 185)

# Rama desactivar (derecha)
r1 = act("Clic en \"Desactivar\"", 185+30, x=RX, w=BW, s=ACT)
r2 = act("Sistema muestra\nConfirmDesactivarModal", 265, x=RX, w=BW)
d2 = dec("¿Confirma?", 335, x=RX + BW//2 - DW//2)
r3 = act("Establecer isActive = false\nRevocar refreshTokens", 430, x=RX, w=BW, h=60)
r4 = act("Mostrar toast de éxito\nEstado → Inactivo", 510, x=RX, w=BW)

# Rama activar (izquierda)
l1 = alt("Clic en \"Activar\"", 185+30, x=LX)
l2 = act("Establecer isActive = true", 265, x=LX, w=BW)
l3 = act("Mostrar toast de éxito\nEstado → Activo", 335, x=LX, w=BW)

en = end_(590)
n_cancel = alt("Sin cambios\n(cancelado)", 430, x=RX + DW + 20)

save("DA-06_Activar_Desactivar_Usuario.xml",
    t, s, a1, d1,
    r1, r2, d2, r3, r4, n_cancel,
    l1, l2, l3,
    en,
    arr(s[0],a1[0]), arr(a1[0],d1[0]),
    arr(d1[0],r1[0],"Activo"), arr(r1[0],r2[0]), arr(r2[0],d2[0]),
    arr(d2[0],r3[0],"Sí"), arr(r3[0],r4[0]), arr(r4[0],en[0]),
    arr(d2[0],n_cancel[0],"No"),
    arr(d1[0],l1[0],"Inactivo"), arr(l1[0],l2[0]), arr(l2[0],l3[0]), arr(l3[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-07 — Resetear Contraseña (CU-08)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-07 — Resetear Contraseña de Usuario (CU-08)")
s  = start(55)
a1 = act("Administrador clic en\n\"Resetear\" junto al usuario", 110)
a2 = act("Sistema muestra ResetPasswordModal", 180)
a3 = act("Sistema genera nueva contraseña\nsegura de 8 caracteres", 250)
a4 = act("Actualizar contraseña con hash bcrypt", 320)
a5 = act("Establecer mustChangePassword = true", 390)
a6 = act("Revocar todos los refreshTokens\nactivos del usuario", 460)
a7 = act("Registrar PASSWORD_RESET_BY_ADMIN\nen AuditLog", 530)
a8 = act("Modal muestra la nueva\ncontraseña temporal", 600)
a9 = act("Administrador entrega la\ncontraseña al usuario", 670)
en = end_(740)

save("DA-07_Resetear_Password.xml",
    t, s, a1, a2, a3, a4, a5, a6, a7, a8, a9, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],a4[0]),
    arr(a4[0],a5[0]), arr(a5[0],a6[0]), arr(a6[0],a7[0]), arr(a7[0],a8[0]),
    arr(a8[0],a9[0]), arr(a9[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-08 — Agregar Equipo al Inventario (CU-09)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-08 — Agregar Equipo al Inventario (CU-09)")
s  = start(55)
a1 = act("Actor accede a sección Equipos", 110)
a2 = act("Clic en \"Agregar equipo\"", 180)
a3 = act("Sistema muestra AgregarEquipoModal", 250)
a4 = act("Completa: numeración, descripción, categoría,\nserie, cantidad, fecha compra, monto, tipo", 320, h=60)
d1 = dec("¿Campos obligatorios\ncompletos?", 405)
r1 = err("Mostrar validaciones\npor campo", 415)
d2 = dec("¿Numeración\nduplificada?", 510)
r2 = err("Mostrar error:\nnumeración ya existe", 520)
a5 = act("Ingresa precios de renta:\ndía, semana, mes (opcionales)", 605, h=60)
a6 = act("Sistema crea el equipo\ncon isActive = true", 690)
a7 = act("Mostrar toast de éxito\ny actualizar tabla", 760)
en = end_(830)

save("DA-08_Agregar_Equipo.xml",
    t, s, a1, a2, a3, a4, d1, r1, d2, r2, a5, a6, a7, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],a4[0]),
    arr(a4[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],a4[0]),
    arr(d1[0],d2[0],"Sí"),
    arr(d2[0],r2[0],"Sí"), arr(r2[0],a4[0]),
    arr(d2[0],a5[0],"No"), arr(a5[0],a6[0]), arr(a6[0],a7[0]), arr(a7[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-09 — Editar Equipo y Actualizar Precios (CU-10, CU-11)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-09 — Editar Equipo / Actualizar Precios (CU-10 y CU-11)")
s  = start(55)
a1 = act("Actor accede a sección Equipos", 110)
d0 = dec("¿Qué acción\ndesea realizar?", 180)

# Editar datos (izquierda)
l1 = act("Clic en \"Editar\"\nen la fila del equipo", 280, x=LX, w=BW)
l2 = act("Sistema muestra\nEditarEquipoModal", 350, x=LX, w=BW)
l3 = act("Modifica los campos deseados", 420, x=LX, w=BW)
l4 = act("Sistema calcula diferencias\ncampo por campo", 490, x=LX, w=BW)

# Actualizar precios (derecha)
r1 = act("Clic en \"Precios\"\nen la fila del equipo", 280, x=RX, w=BW)
r2 = act("Sistema muestra\nPreciosEquipoModal", 350, x=RX, w=BW)
r3 = act("Actualiza precios día,\nsemana y/o mes", 420, x=RX, w=BW)
r4 = dec("¿Precios negativos?", 490, x=RX + BW//2 - DW//2)
r5 = err("Mostrar error de\nvalidación", 560, x=RX + DW + 10, h=40)

# Convergen
a5 = act("Sistema genera entrada en Bitácora\npor cada campo/precio modificado", 580, h=60)
a6 = act("Actualizar registro y mostrar\ntoast de éxito", 660)
en = end_(730)

save("DA-09_Editar_Equipo_y_Precios.xml",
    t, s, a1, d0,
    l1, l2, l3, l4,
    r1, r2, r3, r4, r5,
    a5, a6, en,
    arr(s[0],a1[0]), arr(a1[0],d0[0]),
    arr(d0[0],l1[0],"Editar datos"), arr(l1[0],l2[0]), arr(l2[0],l3[0]), arr(l3[0],l4[0]), arr(l4[0],a5[0]),
    arr(d0[0],r1[0],"Actualizar precios"), arr(r1[0],r2[0]), arr(r2[0],r3[0]), arr(r3[0],r4[0]),
    arr(r4[0],r5[0],"Sí"), arr(r5[0],r3[0]),
    arr(r4[0],a5[0],"No"),
    arr(a5[0],a6[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-10 — Dar de Baja y Reactivar Equipo (CU-12, CU-13)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-10 — Dar de Baja / Reactivar Equipo (CU-12 y CU-13)")
s  = start(55)
d0 = dec("¿Qué acción\ndesea realizar?", 110)

# Dar de baja (izquierda)
l1 = act("Clic en \"Dar de baja\"\nen equipo activo", 200, x=LX, w=BW)
l2 = act("Sistema muestra\nBajaEquipoModal", 270, x=LX, w=BW)
l3 = act("Administrador ingresa\nmotivo de baja", 340, x=LX, w=BW)
ld = dec("¿Motivo ingresado?", 410, x=LX+BW//2-DW//2)
le = err("Solicitar motivo\nobligatorio", 490, x=LX-10, h=40)
l4 = act("Sistema: isActive=false\nRegistra motivoBaja y fechaBaja", 495, x=LX, w=BW, h=60)

# Reactivar (derecha)
r1 = act("Clic en \"Reactivar\"\nen equipo dado de baja", 200, x=RX, w=BW)
r2 = act("Sistema muestra spinner\ny procesa reactivación", 270, x=RX, w=BW)
rd = dec("¿Error de servidor?", 340, x=RX+BW//2-DW//2)
re = err("Revertir estado visual\nMostrar error", 415, x=RX+DW+10, h=40)
r3 = act("isActive=true\nLimpiar motivoBaja y fechaBaja", 425, x=RX, w=BW, h=60)

# Convergen
a5 = act("Sistema genera entrada\nen Bitácora", 580)
a6 = act("Actualizar tabla y\nmostrar toast de éxito", 650)
en = end_(720)

save("DA-10_Baja_Reactivar_Equipo.xml",
    t, s, d0,
    l1, l2, l3, ld, le, l4,
    r1, r2, rd, re, r3,
    a5, a6, en,
    arr(s[0],d0[0]),
    arr(d0[0],l1[0],"Dar de baja"), arr(l1[0],l2[0]), arr(l2[0],l3[0]), arr(l3[0],ld[0]),
    arr(ld[0],le[0],"No"), arr(le[0],l3[0]),
    arr(ld[0],l4[0],"Sí"), arr(l4[0],a5[0]),
    arr(d0[0],r1[0],"Reactivar"), arr(r1[0],r2[0]), arr(r2[0],rd[0]),
    arr(rd[0],re[0],"Sí"),
    arr(rd[0],r3[0],"No"), arr(r3[0],a5[0]),
    arr(a5[0],a6[0]), arr(a6[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-11 — Generar Reporte PDF (CU-14)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-11 — Generar Reporte PDF de Inventario (CU-14)")
s  = start(55)
a1 = act("Actor accede a sección Equipos", 110)
a2 = act("Clic en \"Generar reporte\"", 180)
a3 = act("Sistema recopila todos los\nequipos de la base de datos", 250)
d1 = dec("¿Existen equipos\nen el sistema?", 325)
r1 = err("Generar reporte vacío\ncon mensaje informativo", 335)
a4 = act("Genera PDF A4 landscape:\ntarjetas resumen por tipo", 430, h=60)
a5 = act("Construye tablas por sección:\nLiviana, Pesada, Uso Propio, Dados de Baja", 510, h=60)
a6 = act("Aplica encabezados, pies de página,\nnúmeros de página y moneda (Q)", 590, h=60)
a7 = act("Descarga el archivo\ninventario_equipos_YYYY-MM-DD.pdf", 670, s=ALT)
en = end_(740)
x1 = end_(400, CX + (RX+BW//2 - CX))

save("DA-11_Reporte_PDF.xml",
    t, s, a1, a2, a3, d1, r1, x1, a4, a5, a6, a7, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],x1[0]),
    arr(d1[0],a4[0],"Sí"), arr(a4[0],a5[0]), arr(a5[0],a6[0]), arr(a6[0],a7[0]), arr(a7[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-12 — Gestionar Clientes (CU-15, CU-16)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-12 — Gestionar Clientes: Registrar y Editar (CU-15 y CU-16)")
s  = start(55)
a1 = act("Actor accede a la sección Clientes", 110)
d0 = dec("¿Qué acción\ndesea realizar?", 180)

# Registrar (izquierda)
l1 = act("Clic en \"Registrar cliente\"", 280, x=LX, w=BW)
l2 = act("Sistema muestra\nRegistrarClienteModal", 350, x=LX, w=BW)
l3 = act("Ingresa: nombre, DPI,\nteléfono (opcional)", 420, x=LX, w=BW)
ld = dec("¿DPI duplicado?", 490, x=LX+BW//2-DW//2)
le = err("Mostrar error:\nDPI ya registrado", 565, x=LX-10, h=40)
l4 = act("Sistema genera código\nCLI-XXXX único", 570, x=LX, w=BW)
l5 = act("Crear registro del cliente", 640, x=LX, w=BW)

# Editar (derecha)
r1 = act("Clic en \"Editar\"\njunto al cliente", 280, x=RX, w=BW)
r2 = act("Sistema muestra formulario\ncon datos actuales", 350, x=RX, w=BW)
r3 = act("Modifica: nombre\ny/o teléfono", 420, x=RX, w=BW)
rd = dec("¿DPI modificado\nduplificado?", 490, x=RX+BW//2-DW//2)
re = err("Mostrar error de\nduplicado", 565, x=RX+DW+10, h=40)
r4 = act("Sistema valida y actualiza\nel registro", 575, x=RX, w=BW)

# Convergen
a5 = act("Mostrar toast de éxito\ny actualizar tabla", 720)
en = end_(790)

save("DA-12_Gestionar_Clientes.xml",
    t, s, a1, d0,
    l1, l2, l3, ld, le, l4, l5,
    r1, r2, r3, rd, re, r4,
    a5, en,
    arr(s[0],a1[0]), arr(a1[0],d0[0]),
    arr(d0[0],l1[0],"Registrar"), arr(l1[0],l2[0]), arr(l2[0],l3[0]), arr(l3[0],ld[0]),
    arr(ld[0],le[0],"Sí"), arr(le[0],l3[0]),
    arr(ld[0],l4[0],"No"), arr(l4[0],l5[0]), arr(l5[0],a5[0]),
    arr(d0[0],r1[0],"Editar"), arr(r1[0],r2[0]), arr(r2[0],r3[0]), arr(r3[0],rd[0]),
    arr(rd[0],re[0],"Sí"), arr(re[0],r3[0]),
    arr(rd[0],r4[0],"No"), arr(r4[0],a5[0]),
    arr(a5[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-13 — Solicitud de Renta: Crear, Aprobar, Rechazar (CU-18, CU-19, CU-20)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-13 — Solicitud de Renta: Crear / Aprobar / Rechazar (CU-18, CU-19, CU-20)")
s  = start(55)
# CU-18
a1 = act("Encargado de Máquinas accede\na Solicitudes de Renta", 110)
a2 = act("Crea nueva solicitud:\nselecciona cliente y equipos", 180, h=60)
d1 = dec("¿Al menos un\nequipo seleccionado?", 265)
r1 = err("Solicitar al menos\nun equipo", 275)
a3 = act("Sistema calcula total estimado\nbasado en precios de renta", 360)
a4 = act("Sistema registra solicitud\ncon estado: PENDIENTE", 430, s=ALT)
# Administrador / Secretaria
a5 = act("Admin / Secretaria visualiza\nsolicitud pendiente en dashboard", 500)
a6 = act("Abre detalle en RentaModal\n(cliente, equipos, período, total)", 570, h=60)
d2 = dec("¿Decisión del\nrevisor?", 655)
# CU-19 Aprobar
l1 = act("Cambiar estado a: APROBADA", 735, x=LX, w=BW)
l2 = act("Marcar equipos como\n\"en renta\"", 805, x=LX, w=BW)
l3 = act("Mover a sección\nRentas Activas", 875, x=LX, w=BW, s=ALT)
# CU-20 Rechazar
r2 = act("Cambiar estado a: RECHAZADA", 735, x=RX, w=BW, s=ERR)
r3 = act("Equipos permanecen\ndisponibles", 805, x=RX, w=BW)

en = end_(945)

save("DA-13_Solicitud_Renta.xml",
    t, s, a1, a2, d1, r1, a3, a4, a5, a6, d2,
    l1, l2, l3, r2, r3, en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],d1[0]),
    arr(d1[0],r1[0],"No"), arr(r1[0],a2[0]),
    arr(d1[0],a3[0],"Sí"), arr(a3[0],a4[0]), arr(a4[0],a5[0]),
    arr(a5[0],a6[0]), arr(a6[0],d2[0]),
    arr(d2[0],l1[0],"Aprobar"), arr(l1[0],l2[0]), arr(l2[0],l3[0]), arr(l3[0],en[0]),
    arr(d2[0],r2[0],"Rechazar"), arr(r2[0],r3[0]), arr(r3[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-14 — Gestionar Rentas Vencidas (CU-22)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-14 — Gestionar Renta Vencida (CU-22)")
s  = start(55)
a1 = act("Actor accede a sección\nRentas Vencidas", 110)
a2 = act("Sistema muestra banner de alerta\ncon total de vencidas", 180)
a3 = act("Se lista cada renta: contrato, cliente,\nequipos, días vencida, recargo estimado", 250, h=60)
d0 = dec("¿Qué acción\ndesea tomar?", 335)

# Notificar individual
lx2 = CX - 350
l1  = act("Clic en \"Notificar\"\npara un cliente", 420, x=lx2-20, w=BW)
l2  = act("Envía notificación\nal cliente", 490, x=lx2-20, w=BW, s=ALT)

# Notificar todos (centro)
c1  = act("Clic en \"Notificar a todos\"", 420)
c2  = act("Envía notificaciones masivas\na todos los clientes vencidos", 490, h=60)

# Devuelto
r1  = act("Clic en \"Devuelto\"", 420, x=RX, w=BW)
r2  = act("Registrar devolución\nestado: Dev. tardía", 490, x=RX, w=BW)
r3  = act("Equipos quedan disponibles\nRenta pasa al historial", 560, x=RX, w=BW, h=60, s=ALT)

en = end_(650)

save("DA-14_Gestionar_Rentas_Vencidas.xml",
    t, s, a1, a2, a3, d0,
    l1, l2,
    c1, c2,
    r1, r2, r3,
    en,
    arr(s[0],a1[0]), arr(a1[0],a2[0]), arr(a2[0],a3[0]), arr(a3[0],d0[0]),
    arr(d0[0],l1[0],"Notificar\nindividual"), arr(l1[0],l2[0]), arr(l2[0],en[0]),
    arr(d0[0],c1[0],"Notificar\na todos"), arr(c1[0],c2[0]), arr(c2[0],en[0]),
    arr(d0[0],r1[0],"Marcar\ncomo devuelto"), arr(r1[0],r2[0]), arr(r2[0],r3[0]), arr(r3[0],en[0]),
)

# ══════════════════════════════════════════════════════════════════════════════
#  DA-15 — Consultar Historial y Bitácora (CU-23, CU-24)
# ══════════════════════════════════════════════════════════════════════════════
reset()
t  = title("DA-15 — Consultar Historial de Rentas y Bitácora (CU-23 y CU-24)")
s  = start(55)
a0 = act("Actor accede al sistema\nautenticado", 110)
d0 = dec("¿Qué módulo\ndesea consultar?", 180)

# Historial CU-23 (izquierda)
l1 = act("Accede a sección\nHistorial de Rentas", 280, x=LX, w=BW)
l2 = act("Sistema muestra tabla:\nID, cliente, equipos,\nperíodo, total, estado, encargado", 350, x=LX, w=BW, h=70)
ld = dec("¿Aplica filtros?", 440, x=LX+BW//2-DW//2)
l3 = act("Filtra por: estado,\nrango de fechas, búsqueda", 520, x=LX, w=BW)
l4 = act("Muestra resultados filtrados", 590, x=LX, w=BW)

# Bitácora CU-24 (derecha)
r1 = act("Accede a sección\nBitácoras", 280, x=RX, w=BW)
r2 = act("Sistema muestra estadísticas:\ntotal, hoy, equipos, usuarios", 350, x=RX, w=BW, h=60)
r3 = act("Sistema muestra tabla:\nfecha, módulo, entidad, campo,\nanterior, nuevo, realizadoPor", 430, x=RX, w=BW, h=70)
rd = dec("¿Aplica filtros?", 520, x=RX+BW//2-DW//2)
r4 = act("Filtra por módulo,\nnombre, campo o usuario", 600, x=RX, w=BW)
r5 = act("Muestra registros filtrados", 670, x=RX, w=BW)

en = end_(730)

save("DA-15_Historial_y_Bitacora.xml",
    t, s, a0, d0,
    l1, l2, ld, l3, l4,
    r1, r2, r3, rd, r4, r5,
    en,
    arr(s[0],a0[0]), arr(a0[0],d0[0]),
    arr(d0[0],l1[0],"Historial\nde Rentas (CU-23)"), arr(l1[0],l2[0]), arr(l2[0],ld[0]),
    arr(ld[0],l3[0],"Sí"), arr(l3[0],l4[0]), arr(l4[0],en[0]),
    arr(ld[0],en[0],"No"),
    arr(d0[0],r1[0],"Bitácora\n(CU-24)"), arr(r1[0],r2[0]), arr(r2[0],r3[0]), arr(r3[0],rd[0]),
    arr(rd[0],r4[0],"Sí"), arr(r4[0],r5[0]), arr(r5[0],en[0]),
    arr(rd[0],en[0],"No"),
)

print("\nTodos los diagramas generados exitosamente.")
