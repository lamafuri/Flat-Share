import axios from 'axios'

// Get API URL from environment, fallback for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

console.log('API Base URL:', API_URL) // Debug log

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests if using token-based auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api