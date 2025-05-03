// permissions.js
export function isAdmin() {
  // retorna true somente se o nível gravado na sessão for “admin”
  return sessionStorage.getItem("nivel") === "admin";
}
