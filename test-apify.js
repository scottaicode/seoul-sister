// Simple Apify test script using native fetch

async function testApifyDirectly() {
  const apiKey = 'apify_api_FLmGznnFDh3LTAxWaVN35wSsGNKnp1rmS9b'

  console.log('🧪 Testing Apify Premium Instagram Actor directly...')

  try {
    // Test premium actor with ponysmakeup
    const premiumInput = {
      usernames: ['ponysmakeup'],
      resultsLimit: 5,
      includeStories: false,
      includeReels: true,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    }

    console.log('🔄 Testing premium actor: shu8hvrXbJbY3Eb9W')
    const response = await fetch('https://api.apify.com/v2/acts/shu8hvrXbJbY3Eb9W/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(premiumInput)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Premium actor failed: ${response.status} - ${errorText}`)

      // Try basic actor as fallback
      console.log('🔄 Trying basic actor: apify/instagram-scraper')
      const basicInput = {
        username: ['ponysmakeup'],
        resultsType: 'posts',
        resultsLimit: 5,
        searchType: 'user'
      }

      const basicResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-scraper/runs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(basicInput)
      })

      if (!basicResponse.ok) {
        const basicErrorText = await basicResponse.text()
        console.error(`❌ Basic actor also failed: ${basicResponse.status} - ${basicErrorText}`)
        return
      }

      const basicData = await basicResponse.json()
      console.log('✅ Basic actor run started:', basicData.data?.id)
      return
    }

    const data = await response.json()
    console.log('✅ Premium actor run started:', data.data?.id)
    console.log('📊 Run details:', {
      id: data.data?.id,
      status: data.data?.status,
      defaultDatasetId: data.data?.defaultDatasetId
    })

    // Wait a bit and check dataset
    if (data.data?.defaultDatasetId) {
      console.log('⏳ Waiting 30 seconds for scraping to complete...')
      await new Promise(resolve => setTimeout(resolve, 30000))

      const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${data.data.defaultDatasetId}/items`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (datasetResponse.ok) {
        const items = await datasetResponse.json()
        console.log(`📋 Dataset contains ${Array.isArray(items) ? items.length : 'unknown'} items`)
        if (Array.isArray(items) && items.length > 0) {
          console.log('📝 Sample item:', JSON.stringify(items[0], null, 2).substring(0, 500) + '...')
        }
      } else {
        console.error('❌ Failed to fetch dataset:', datasetResponse.status)
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testApifyDirectly()