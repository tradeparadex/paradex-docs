import { datadogRum } from '@datadog/browser-rum';

datadogRum.init({
    applicationId: '1cd44299-5296-4e90-9223-6c57851fe26c',
    clientToken: 'pub4b13754fd69e532575d8432457cf665d',
    // `site` refers to the Datadog site parameter of your organization
    // see https://docs.datadoghq.com/getting_started/site/
    site: 'datadoghq.com',
    service: 'paradex-docs-tests',
    env: 'test',
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    defaultPrivacyLevel: 'mask-user-input',
});