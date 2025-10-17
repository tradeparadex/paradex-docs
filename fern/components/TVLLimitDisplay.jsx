import React from 'react';
import fs from 'fs';
import path from 'path';

// Component to display TVL limit from generated config
export function TVLLimitDisplay({ fallback = "50 million USDC" }) {
  const [tvlLimit, setTvlLimit] = React.useState(fallback);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    try {
      // Try to read the generated TVL config file
      const configPath = path.join(process.cwd(), 'fern', 'config', 'tvl-limit.json');
      
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        setTvlLimit(configData.tvlLimit.formattedValue);
      } else {
        console.warn('TVL config file not found, using fallback value');
        setTvlLimit(fallback);
      }
    } catch (err) {
      console.error('Error reading TVL config:', err);
      setError(err.message);
      setTvlLimit(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [fallback]);

  if (isLoading) {
    return <span>{fallback}</span>;
  }

  if (error) {
    console.warn('TVL limit display error:', error);
    return <span>{fallback}</span>;
  }

  return (
    <span style={{ color: '#c83efb' }}>
      {tvlLimit}
    </span>
  );
}

export default TVLLimitDisplay;
