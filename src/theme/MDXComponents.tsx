// Components available in every MDX page without an import. These mirror
// Fern's built-in components so the content written for Fern renders as-is.

import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import Icon from '@site/src/components/fern/Icon';
import {Card, CardGroup} from '@site/src/components/fern/Card';
import {Callout, Check, ErrorCallout, Info, Launch, Note, Success, Tip, Warning} from '@site/src/components/fern/Callout';
import {Tab, Tabs} from '@site/src/components/fern/Tabs';
import {Accordion, AccordionGroup, Badge, Button, ChangelogTags, Frame, Step, Steps} from '@site/src/components/fern/Layout';
import {CodeBlock, CodeBlocks} from '@site/src/components/fern/CodeBlocks';
import ApiEndpoint, {EndpointRequestSnippet, EndpointResponseSnippet} from '@site/src/components/api/ApiEndpoint';
import MermaidDiagram from '@site/src/components/MermaidDiagram';

/** Markdown tables sit in a bordered card that scrolls sideways, as on Fern. */
function Table(props: React.ComponentProps<'table'>) {
  return (
    <div className="fern-table">
      <table {...props} />
    </div>
  );
}

export default {
  ...MDXComponents,
  table: Table,
  Icon,
  Card,
  CardGroup,
  Cards: CardGroup,
  Callout,
  Note,
  Info,
  Tip,
  Warning,
  Error: ErrorCallout,
  Success,
  Check,
  Launch,
  Tabs,
  Tab,
  Accordion,
  AccordionGroup,
  Steps,
  Step,
  Frame,
  Badge,
  Button,
  CodeBlock,
  CodeBlocks,
  ChangelogTags,
  ApiEndpoint,
  EndpointRequestSnippet,
  EndpointResponseSnippet,
  MermaidDiagram,
};
