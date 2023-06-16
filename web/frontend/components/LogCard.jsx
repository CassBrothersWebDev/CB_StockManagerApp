import { Card, Scrollable } from "@shopify/polaris";
import {useEffect, useRef} from 'react';

export function LogCard({ title, log }) {
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        // Scroll to the bottom when new content is added
        const scrollContainer = scrollContainerRef.current;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }, [log]);

  return (
    <Card title={title || " Update Log"} sectioned>
      
        <div style={{ height: "175px", overflowY: "auto", border: '1px solid #D8DCDD', borderRadius: '15px', padding: '15px' }} ref={scrollContainerRef}>
          {log && log.map((item, index) => (
            <p key={index} style={{color: item.color}}>{item.message}</p>
          ))}
        </div>
      
    </Card>
  );
}
