declare module 'react-plotly.js' {
    import * as React from 'react';
    interface PlotParams {
        data: any[];
        layout: any;
        config?: any;
        frames?: any[];
        style?: React.CSSProperties;
        useResizeHandler?: boolean;
        className?: string;
        onInitialized?: (figure: any, graphDiv: any) => void;
        onUpdate?: (figure: any, graphDiv: any) => void;
        onPurge?: (figure: any, graphDiv: any) => void;
        onError?: (err: any) => void;
    }
    export default class Plot extends React.Component<PlotParams> {}
}
