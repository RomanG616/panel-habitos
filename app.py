from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pyodbc
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

CONN_STR = (
    "Driver={ODBC Driver 17 for SQL Server};"
    "Server=HabitosDB_Roman.mssql.somee.com;"
    "Database=HabitosDB_Roman;"
    "UID=romang616_SQLLogin_1;"
    "PWD=9ywhzt92pi;"
    "Encrypt=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=30;"
)

def get_connection():
    return pyodbc.connect(CONN_STR)

def obtener_lunes_actual():
    hoy = datetime.today().date()
    return hoy - timedelta(days=hoy.weekday())

@app.route('/')
def index():
    return send_from_directory('.', 'Habitos.html')

# ==================== AUTENTICACIÓN ====================

@app.route('/api/register', methods=['POST'])
def registrar_usuario():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if len(username) < 3 or len(password) < 4:
        return jsonify({"error": "El usuario debe tener al menos 3 caracteres y la contraseña 4."}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT IdUsuario FROM Usuarios WHERE NombreUsuario = ?", username)
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": "Ese nombre de usuario ya está registrado."}), 409

    pw_hash = generate_password_hash(password)
    cursor.execute(
        "INSERT INTO Usuarios (NombreUsuario, PasswordHash) OUTPUT INSERTED.IdUsuario VALUES (?, ?)",
        username, pw_hash
    )
    user_id = cursor.fetchone()[0]

    habitos_iniciales = [
        'Programar / Práctica de código',
        'Entrenamiento físico',
        'Lectura (20 min)'
    ]
    for h in habitos_iniciales:
        cursor.execute("INSERT INTO Habitos (IdUsuario, Nombre) VALUES (?, ?)", user_id, h)

    conn.commit()
    conn.close()
    return jsonify({"id": user_id, "username": username}), 201

@app.route('/api/login', methods=['POST'])
def iniciar_sesion():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT IdUsuario, NombreUsuario, PasswordHash FROM Usuarios WHERE NombreUsuario = ?", username)
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user.PasswordHash, password):
        return jsonify({"error": "Usuario o contraseña incorrectos."}), 401

    return jsonify({"id": user.IdUsuario, "username": user.NombreUsuario})

# ==================== HÁBITOS SEMANALES ====================

@app.route('/api/habitos', methods=['GET'])
def obtener_habitos():
    user_id = request.args.get('userId', type=int)
    if not user_id:
        return jsonify({"error": "No autorizado"}), 401

    lunes = obtener_lunes_actual()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("EXEC sp_ObtenerSemanaHabitos ?, ?", user_id, lunes)
    filas = cursor.fetchall()
    
    resultado = []
    for f in filas:
        resultado.append({
            "id": f.IdHabito,
            "name": f.Nombre,
            "days": [
                bool(f.Lunes), bool(f.Martes), bool(f.Miercoles),
                bool(f.Jueves), bool(f.Viernes), bool(f.Sabado), bool(f.Domingo)
            ]
        })
    conn.close()
    return jsonify(resultado)

@app.route('/api/habitos', methods=['POST'])
def agregar_habito():
    data = request.json
    user_id = data.get('userId')
    nombre = data.get('name', '').strip()
    if not user_id or not nombre:
        return jsonify({"error": "Datos incompletos"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO Habitos (IdUsuario, Nombre) VALUES (?, ?)", int(user_id), nombre)
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"}), 201

@app.route('/api/toggle', methods=['POST'])
def alternar_dia():
    data = request.json
    lunes = obtener_lunes_actual()
    fecha_objetivo = lunes + timedelta(days=int(data['dayIndex']))
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "EXEC sp_AlternarRegistroHabito ?, ?, ?", 
        int(data['habitId']), 
        fecha_objetivo, 
        int(bool(data['completed']))
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

@app.route('/api/habitos/<int:habit_id>', methods=['DELETE'])
def eliminar_habito(habit_id):
    user_id = request.args.get('userId', type=int)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Habitos WHERE IdHabito = ? AND IdUsuario = ?", habit_id, user_id)
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

@app.route('/api/reset', methods=['POST'])
def reiniciar_semana():
    data = request.json
    user_id = int(data.get('userId'))
    lunes = obtener_lunes_actual()
    domingo = lunes + timedelta(days=6)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE r FROM RegistrosDiarios r
        INNER JOIN Habitos h ON r.IdHabito = h.IdHabito
        WHERE h.IdUsuario = ? AND r.Fecha BETWEEN ? AND ?
    """, user_id, lunes, domingo)
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

# ==================== HISTORIAL Y ESTADÍSTICAS ====================

@app.route('/api/historial', methods=['GET'])
def obtener_historial():
    user_id = request.args.get('userId', type=int)
    if not user_id:
        return jsonify({"error": "No autorizado"}), 401

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Resumen por hábito histórico
    cursor.execute("EXEC sp_ObtenerHistorialUsuario ?", user_id)
    habitos_hist = []
    total_checkins = 0
    for row in cursor.fetchall():
        total_checkins += row.TotalCompletados
        habitos_hist.append({
            "id": row.IdHabito,
            "name": row.Nombre,
            "createdAt": row.FechaCreacion,
            "totalCompleted": row.TotalCompletados,
            "lastDate": row.UltimaFecha
        })

    # 2. Últimos 20 registros cronológicos marcados como completados
    cursor.execute("""
        SELECT TOP 20 h.Nombre, CONVERT(VARCHAR(10), r.Fecha, 23) AS Fecha
        FROM RegistrosDiarios r
        INNER JOIN Habitos h ON r.IdHabito = h.IdHabito
        WHERE h.IdUsuario = ? AND r.Completado = 1
        ORDER BY r.Fecha DESC, r.IdRegistro DESC
    """, user_id)
    bitacora = [{"habitName": r.Nombre, "date": r.Fecha} for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        "totalHabits": len(habitos_hist),
        "totalCheckins": total_checkins,
        "habits": habitos_hist,
        "recentLogs": bitacora
    })
# Obtener las fechas cumplidas de un hábito para dibujarlo en el calendario
@app.route('/api/habitos/<int:habit_id>/calendario', methods=['GET'])
def calendario_habito(habit_id):
    user_id = request.args.get('userId', type=int)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT IdHabito, Nombre, CONVERT(VARCHAR(10), FechaCreacion, 23) AS FechaCreacion
        FROM Habitos
        WHERE IdHabito = ? AND IdUsuario = ?
    """, habit_id, user_id)
    h = cursor.fetchone()
    if not h:
        conn.close()
        return jsonify({"error": "Hábito no encontrado"}), 404

    cursor.execute("""
        SELECT CONVERT(VARCHAR(10), Fecha, 23) AS Fecha
        FROM RegistrosDiarios
        WHERE IdHabito = ? AND Completado = 1
    """, habit_id)
    fechas_cumplidas = [r.Fecha for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        "id": h.IdHabito,
        "name": h.Nombre,
        "createdAt": h.FechaCreacion,
        "completedDates": fechas_cumplidas
    })

# Permitir marcar o desmarcar cualquier fecha directamente desde el calendario
@app.route('/api/toggle_fecha', methods=['POST'])
def alternar_fecha_exacta():
    data = request.json
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "EXEC sp_AlternarRegistroHabito ?, ?, ?",
        int(data['habitId']),
        data['date'],
        int(bool(data['completed']))
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

# ==================== SISTEMA DE AMIGOS ====================

@app.route('/api/amigos', methods=['GET'])
def listar_amigos():
    user_id = request.args.get('userId', type=int)
    if not user_id:
        return jsonify({"error": "No autorizado"}), 401

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Solicitudes pendientes recibidas
    cursor.execute("""
        SELECT a.IdAmistad, u.IdUsuario, u.NombreUsuario, CONVERT(VARCHAR(10), a.FechaSolicitud, 23) AS Fecha
        FROM Amistades a
        INNER JOIN Usuarios u ON a.IdSolicitante = u.IdUsuario
        WHERE a.IdReceptor = ? AND a.Estado = 'Pendiente'
    """, user_id)
    recibidas = [{"requestId": r.IdAmistad, "userId": r.IdUsuario, "username": r.NombreUsuario, "date": r.Fecha} for r in cursor.fetchall()]

    # 2. Solicitudes pendientes enviadas
    cursor.execute("""
        SELECT a.IdAmistad, u.IdUsuario, u.NombreUsuario
        FROM Amistades a
        INNER JOIN Usuarios u ON a.IdReceptor = u.IdUsuario
        WHERE a.IdSolicitante = ? AND a.Estado = 'Pendiente'
    """, user_id)
    enviadas = [{"requestId": r.IdAmistad, "userId": r.IdUsuario, "username": r.NombreUsuario} for r in cursor.fetchall()]

    # 3. Amigos aceptados + estadísticas rápidas
    cursor.execute("""
        SELECT 
            u.IdUsuario,
            u.NombreUsuario,
            (SELECT COUNT(*) FROM Habitos h WHERE h.IdUsuario = u.IdUsuario AND h.Activo = 1) AS TotalHabitos,
            (SELECT COUNT(*) FROM RegistrosDiarios r INNER JOIN Habitos h ON r.IdHabito = h.IdHabito WHERE h.IdUsuario = u.IdUsuario AND r.Completado = 1) AS TotalCumplidos
        FROM Amistades a
        INNER JOIN Usuarios u 
            ON (a.IdSolicitante = ? AND a.IdReceptor = u.IdUsuario)
            OR (a.IdReceptor = ? AND a.IdSolicitante = u.IdUsuario)
        WHERE a.Estado = 'Aceptada'
    """, user_id, user_id)
    amigos = [{
        "userId": r.IdUsuario,
        "username": r.NombreUsuario,
        "totalHabits": r.TotalHabitos,
        "totalCompleted": r.TotalCumplidos
    } for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        "incoming": recibidas,
        "outgoing": enviadas,
        "friends": amigos
    })

@app.route('/api/amigos/solicitar', methods=['POST'])
def enviar_solicitud():
    data = request.json
    user_id = int(data.get('userId'))
    target_username = data.get('username', '').strip()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT IdUsuario, NombreUsuario FROM Usuarios WHERE NombreUsuario = ?", target_username)
    target = cursor.fetchone()
    if not target:
        conn.close()
        return jsonify({"error": "No existe ningún usuario con ese nombre."}), 404

    if target.IdUsuario == user_id:
        conn.close()
        return jsonify({"error": "No puedes enviarte una solicitud a ti mismo."}), 400

    # Verificar si ya existe relación en cualquier dirección
    cursor.execute("""
        SELECT Estado FROM Amistades 
        WHERE (IdSolicitante = ? AND IdReceptor = ?) 
           OR (IdSolicitante = ? AND IdReceptor = ?)
    """, user_id, target.IdUsuario, target.IdUsuario, user_id)
    existente = cursor.fetchone()
    if existente:
        conn.close()
        msg = "Ya son amigos." if existente.Estado == 'Aceptada' else "Ya hay una solicitud pendiente con este usuario."
        return jsonify({"error": msg}), 409

    cursor.execute(
        "INSERT INTO Amistades (IdSolicitante, IdReceptor, Estado) VALUES (?, ?, 'Pendiente')",
        user_id, target.IdUsuario
    )
    conn.commit()
    conn.close()
    return jsonify({"message": f"Solicitud enviada a {target.NombreUsuario}"}), 201

@app.route('/api/amigos/responder', methods=['POST'])
def responder_solicitud():
    data = request.json
    request_id = int(data.get('requestId'))
    action = data.get('action') # 'accept' o 'reject'

    conn = get_connection()
    cursor = conn.cursor()
    if action == 'accept':
        cursor.execute("UPDATE Amistades SET Estado = 'Aceptada' WHERE IdAmistad = ?", request_id)
    else:
        cursor.execute("DELETE FROM Amistades WHERE IdAmistad = ?", request_id)
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

@app.route('/api/amigos/estadisticas/<int:friend_id>', methods=['GET'])
def estadisticas_amigo(friend_id):
    lunes = obtener_lunes_actual()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT NombreUsuario FROM Usuarios WHERE IdUsuario = ?", friend_id)
    u = cursor.fetchone()
    if not u:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404

    # Semana actual del amigo
    cursor.execute("EXEC sp_ObtenerSemanaHabitos ?, ?", friend_id, lunes)
    semana = []
    checks_semana = 0
    for f in cursor.fetchall():
        dias = [bool(f.Lunes), bool(f.Martes), bool(f.Miercoles), bool(f.Jueves), bool(f.Viernes), bool(f.Sabado), bool(f.Domingo)]
        checks_semana += sum(1 for d in dias if d)
        semana.append({"name": f.Nombre, "days": dias})

    # Historial acumulado del amigo
    cursor.execute("EXEC sp_ObtenerHistorialUsuario ?", friend_id)
    historial = []
    total_historico = 0
    for h in cursor.fetchall():
        total_historico += h.TotalCompletados
        historial.append({
            "name": h.Nombre,
            "createdAt": h.FechaCreacion,
            "totalCompleted": h.TotalCompletados,
            "lastDate": h.UltimaFecha
        })

    conn.close()
    posibles = len(semana) * 7
    porcentaje_semana = round((checks_semana / posibles) * 100) if posibles > 0 else 0

    return jsonify({
        "username": u.NombreUsuario,
        "weeklyRate": porcentaje_semana,
        "weeklyChecks": checks_semana,
        "totalHistorical": total_historico,
        "weeklyHabits": semana,
        "historicalHabits": historial
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)