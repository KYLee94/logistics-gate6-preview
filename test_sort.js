const arr = [
  { created_at: "2026-03-27T00:00:00+00:00", name: "1" },
  { created_at: "2026-02-13T00:00:00+00:00", name: "2" },
  { created_at: "2026-03-25T00:00:00+00:00", name: "3" },
  { created_at: null, name: "4" }
];
arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
console.log(arr);
