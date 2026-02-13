/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false
    }

    if (isServer) {
      config.externals.push({
        '@supabase/supabase-js': 'commonjs @supabase/supabase-js'
      })
    }
    return config
  },
}

module.exports = nextConfig
