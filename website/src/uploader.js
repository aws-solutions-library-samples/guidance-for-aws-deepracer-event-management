
import React, { Component } from 'react';
import { Storage } from 'aws-amplify';
import { Button, Progress, Message, Icon } from 'semantic-ui-react';

class Uploader extends Component {
    constructor(props) {
      super(props);
      this.containerDiv = React.createRef();
      this.state = {
        percent: 0,
        result: '',
        filename: ''
      };
    }
  
    fileInputRef = React.createRef();

    async onChange(e) {
        const file = e.target.files[0];
        console.log(file)
        this.setState({filename: file.name})
        const localthis = this;
        await Storage.put(("models/uploaded/" + file.name), file, {
          level: 'public',
          contentType: file.type,
          progressCallback(progress) {
            var currentpercent = Math.round(progress.loaded/progress.total*100)
            localthis.setState({percent: currentpercent})
            console.log('Uploading:' + localthis.state.percent)
          },
        }).then (result => {
          this.setState({result: 
            <Message success>
            <Message.Header>Uploaded</Message.Header>
            <p>{this.state.filename}</p>
          </Message>
          })
          console.log(result)
          }
        ).catch(err => {
          this.setState({result: 
          <Message negative>
            <Message.Header>Error whilst uploading</Message.Header>
            <p>{this.state.filename}</p>
          </Message>
          })
          console.log(err)
          }
        );
    }
    
    render() {
      let buttonstate;
      let progressbar;
      if (100 > this.state.percent && this.state.percent > 0 ) { 
        buttonstate = 
          <Message icon>
            <Icon name='circle notched' loading />
            <Message.Content>
              <Message.Header>Uploading</Message.Header>
              <p>{this.state.filename}</p>
            </Message.Content>
          </Message>;
        progressbar = <Progress percent={this.state.percent} indicating progress='percent'/>;
      }
      else if (100 === this.state.percent){
        buttonstate = null;
        progressbar = null;
      }
      else {        
        buttonstate =
          <div>
            <Button
              content="Choose File"
              labelPosition="left"
              icon="file"
              onClick={() => this.fileInputRef.current.click()}
            /> 
            <input
              ref={this.fileInputRef}
              type="file" accept='application/gzip'
              hidden
              onChange={(e) => this.onChange(e)}
            />
          </div> 
        progressbar = <Progress percent={this.state.percent} indicating progress='percent'/>;
      }
  
      return (
          <div>
            {progressbar}
            {this.state.result}
            {buttonstate}
          </div>
      )
    }
}

export {Uploader}