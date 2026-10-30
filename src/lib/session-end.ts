// Cierre de sesión en curso. Al cerrar, el token se borra y las pantallas que siguen montadas
// (p. ej. el dashboard) vuelven a pedir sus datos sin él: el cliente de la API cancela esas
// peticiones antes de enviarlas, así no llegan al servidor como 401 ni dejan un aviso de error.
// La página se recarga justo después (`window.location.href`), lo que reinicia esta marca.
let ending = false;

export function markSessionEnding(): void {
  ending = true;
}

export function isSessionEnding(): boolean {
  return ending;
}

/** Solo para pruebas. */
export function resetSessionEnding(): void {
  ending = false;
}
