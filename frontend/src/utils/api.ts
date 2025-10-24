import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

// 🚗 CAR ROUTES
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // allows cookies if you use sessions
});

// 🚗 Cars
export const getAllCars = async () => {
  const { data } = await api.get("/cars");
  return data;
};

export const addCar = async (payload) => {
  const { data } = await api.post("/cars", payload);
  return data;
};

export const updateCar = async (id, payload) => {
  const { data } = await api.put(`/cars/${id}`, payload);
  return data;
};

export const deleteCar = async (id) => {
  await api.delete(`/cars/${id}`);
};

export const toggleFeatured = async (id, featured) => {
  const { data } = await api.patch(`/cars/${id}/featured`, { featured });
  return data;
};

export const updateCarStatus = async (id, status) => {
  const { data } = await api.patch(`/cars/${id}/status`, { status });
  return data;
};

export const replaceGallery = async (id, gallery) => {
  const { data } = await api.patch(`/cars/${id}/gallery`, { gallery });
  return data;
};

// 👤 Dealers
export const getAllDealers = async () => {
  const { data } = await api.get("/dealers");
  return data;
};

export const addDealer = async (payload) => {
  const { data } = await api.post("/dealers", payload);
  return data;
};

export const deleteDealer = async (id) => {
  await api.delete(`/dealers/${id}`);
};