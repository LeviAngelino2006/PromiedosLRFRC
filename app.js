require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- NUEVO: Necesario para leer las rutas de archivos
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// <-- NUEVO: Le decimos a Express que muestre los archivos de la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// --- RUTAS PÚBLICAS ---

app.get('/api/partidos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('partidos')
            .select(`
                *,
                club_local:clubes!id_club_local(id_club, nombre, acronimo, escudo_url, id_division, zona),
                club_visitante:clubes!id_club_visitante(id_club, nombre, acronimo, escudo_url),
                categoria:categorias(nombre)
            `)
            .order('id_partido', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/partidos/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('partidos')
            .select(`
                *,
                club_local:clubes!id_club_local(nombre, acronimo, escudo_url),
                club_visitante:clubes!id_club_visitante(nombre, acronimo, escudo_url),
                categoria:categorias(nombre),
                cancha:canchas(nombre, direccion, capacidad),
                arbitro:arbitros(nombre),
                eventos(minuto, tipo_evento, tipo_doc_jugador, nro_doc_jugador, jugador:jugadores(apellido, nombre, id_club))
            `)
            .eq('id_partido', req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(404).json({ error: "Partido no encontrado" }); }
});

app.get('/api/goleadores', async (req, res) => {
    try {
        const { data, error } = await supabase.from('ranking_goleadores').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Error goleadores" }); }
});

app.get('/api/posiciones/a', async (req, res) => {
    try {
        const { data, error } = await supabase.from('posiciones_primera_a').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Error posiciones A" }); }
});

app.get('/api/posiciones/b', async (req, res) => {
    try {
        const { data, error } = await supabase.from('posiciones_primera_b').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Error posiciones B" }); }
});

app.get('/api/clubes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clubes')
            .select('*')
            .eq('id_club', req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(404).json({ error: "Club no encontrado" }); }
});

app.get('/api/clubes/:id/partidos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('partidos')
            .select(`
                *,
                club_local:clubes!id_club_local(id_club, nombre, acronimo, escudo_url),
                club_visitante:clubes!id_club_visitante(id_club, nombre, acronimo, escudo_url)
            `)
            .or(`id_club_local.eq.${req.params.id},id_club_visitante.eq.${req.params.id}`)
            .order('id_partido', { ascending: false }); 
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- RUTAS ADMINISTRATIVAS ---

// ACTUALIZADA: Ahora recibe y guarda 'fecha_hora'
app.post('/api/partidos/actualizar', async (req, res) => {
    const { id_partido, estado, goles_local, goles_visitante, fecha_hora } = req.body;
    try {
        let updateData = { estado, goles_local, goles_visitante };
        if (fecha_hora !== undefined) updateData.fecha_hora = fecha_hora;

        const { data, error } = await supabase
            .from('partidos')
            .update(updateData)
            .eq('id_partido', id_partido)
            .select();
        if (error) throw error;
        res.json({ mensaje: "Partido actualizado", data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/clubes/:id/jugadores', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jugadores')
            .select('tipo_doc, nro_doc, apellido, nombre, posicion, fecha_nacimiento')
            .eq('id_club', req.params.id)
            .order('apellido', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/eventos', async (req, res) => {
    const { id_partido, tipo_doc, nro_doc, minuto, tipo_evento } = req.body;
    try {
        const { data, error } = await supabase
            .from('eventos')
            .insert([{ 
                id_partido: id_partido, 
                tipo_doc_jugador: tipo_doc, 
                nro_doc_jugador: nro_doc, 
                minuto: minuto, 
                tipo_evento: tipo_evento 
            }]);
        if (error) throw error;
        res.json({ mensaje: "Evento registrado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/eventos/eliminar', async (req, res) => {
    const { id_partido, tipo_doc, nro_doc, minuto, tipo_evento } = req.body;
    try {
        const { data, error } = await supabase
            .from('eventos')
            .delete()
            .eq('id_partido', id_partido)
            .eq('tipo_doc_jugador', tipo_doc)
            .eq('nro_doc_jugador', nro_doc)
            .eq('minuto', minuto)
            .eq('tipo_evento', tipo_evento);
        if (error) throw error;
        res.json({ mensaje: "Evento eliminado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
    console.log(`Servidor LFRC andando en el puerto ${port}`);
});