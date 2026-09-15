import axios from 'axios'

// Get API URL from environment, fallback for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
    // A 401 only means the session expired when the request was sent with a
    // token. Sign-in attempts also return 401 for wrong credentials; those
    // must reach the page so it can show the error instead of reloading.
    const sentToken = Boolean(error.config?.headers?.Authorization)
    const isLoginRequest = error.config?.url === '/auth/login'

    if (error.response?.status === 401 && sentToken && !isLoginRequest) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api