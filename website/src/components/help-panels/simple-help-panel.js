import { HelpPanel } from '@cloudscape-design/components';
import ReactMarkdown from 'react-markdown';

export const SimpleHelpPanelLayout = ({ headerContent, bodyContent, footerContent }) => {
  return (
    <HelpPanel
      header={<ReactMarkdown children={headerContent} />}
      footer={<ReactMarkdown children={footerContent} />}
    >
      <div>
        <ReactMarkdown children={bodyContent} />
      </div>
    </HelpPanel>
  );
};
