

import React, { Component } from 'react';
import { Storage, API } from 'aws-amplify';
import { Image as ImageSR, Table, Button } from 'semantic-ui-react';

const path = require('path')
class Models extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      percent: 0,
      result: '',
      filename: '',
      models: [],
      view: 'list',
    };
  }

  componentDidMount = async () => {
    async function getModels() { 
      return await Storage.list('models/uploaded/', { level: 'public' })
    }

    this._isMounted = true;
    
    // Collect Image data
    this.setState({ files: [] })
    let models = await getModels();
    console.log(models);
    this.setState({ models: models })
    // let enhancedArrayedResult = [];
    // models.forEach(element => {
    //   let thumbnailKey = path.relative('/public', element.thumbnailKey);
    //   let presignedurl = Storage.get(thumbnailKey)
    //   presignedurl.then(url => {
    //     element.presignedurl = url
    //     enhancedArrayedResult = this.state.files
    //     enhancedArrayedResult.push(element)
    //     this.setState({ files: enhancedArrayedResult })
    //     //console.log(element)
    //   })
    // })
    
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onDeleteClickHandler = async(clickitem) => {
    async function deleteImage(key) { 
      return await Storage.remove(key)
    }

    console.log(clickitem['key'])

    let response = await deleteImage(clickitem['key'])
    console.log(response)

    this.componentDidMount()
  }

  onUploadClickHandler = async(clickitem) => {
    console.log("Upload to Car " + clickitem['key'])

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars';
    // const myInit = { 
    //   body: {
    //     key: clickitem['key']
    //   }
    // };

    let response = await API.get(apiName, apiPath);
    //let response = await API.post(apiName, apiPath, myInit);
    console.log(response)

    this.componentDidMount()
  }

  //
  render() {
    var tablerows = this.state.models.map(function (item, i) {
      return <Table.Row key={i} >
        <Table.Cell>{item.key} </Table.Cell>
        <Table.Cell><Button positive circular icon='upload' onClick={(event) => this.onUploadClickHandler(item)}/></Table.Cell>
        <Table.Cell><Button negative circular icon='delete' onClick={(event) => this.onDeleteClickHandler(item)}/></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''
    
    if (this.state.view === 'list'){
      content = <Table celled striped>
      <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Upload to Car</Table.HeaderCell>
            <Table.HeaderCell>Delete</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tablerows}
        </Table.Body>
      </Table>
    }
    


    return (
      <div>
      {content}
    </div>
    )
  }
}

export {Models}