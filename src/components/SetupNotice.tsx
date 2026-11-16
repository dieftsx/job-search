export default function SetupNotice() {
  return (
    <main className="auth">
      <h1 className="center">VAGAS AUTO</h1>
      <div className="panel">
        <h2 style={{ margin: 0 }}>Falta configurar o Firebase</h2>
        <p style={{ margin: 0 }}>
          Defina as variáveis <code>NEXT_PUBLIC_FIREBASE_*</code> (veja o
          arquivo <code>.env.example</code> e o README) e publique de novo.
        </p>
      </div>
    </main>
  );
}
