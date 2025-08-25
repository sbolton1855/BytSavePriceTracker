
// API utility functions
const API_BASE = '/api'

export async function getTrackedProducts() {
  try {
    const response = await fetch(`${API_BASE}/tracked-products`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (response.status === 401) {
      return { 
        success: false, 
        needsAuth: true, 
        data: null 
      }
    }

    if (!response.ok) {
      const isJson = response.headers.get('content-type')?.includes('application/json')
      if (isJson) {
        const errorData = await response.json()
        return { 
          success: false, 
          needsAuth: false, 
          error: errorData.error || 'API error',
          data: null 
        }
      } else {
        const htmlText = await response.text()
        console.error('[API] Expected JSON but got HTML:', htmlText.slice(0, 200))
        return { 
          success: false, 
          needsAuth: false, 
          error: 'API returned HTML instead of JSON',
          data: null 
        }
      }
    }

    const data = await response.json()
    return { 
      success: true, 
      needsAuth: false, 
      data,
      error: null 
    }

  } catch (error: any) {
    console.error('[API] Network error:', error)
    return { 
      success: false, 
      needsAuth: false, 
      error: 'Network error: ' + error.message,
      data: null 
    }
  }
}
