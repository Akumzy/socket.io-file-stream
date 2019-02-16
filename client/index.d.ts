///<reference types="node" />
export = UploadClient
interface UploadClient extends NodeJS.EventEmitter {
  /**
   * Start file upload and gets response
   * when the upload is done through callback
   */
  upload(event: string, cb: (...data: any) => void): this
  /**
   * This event emits once it's ready to start upload
   */
  on(event: 'ready', listener: () => void): this
  /**
   * This event emits the upload progress on upload
   * and return an object containing the upload
   * statistics to the `listener`
   * `size` being the file size and
   * `total` being to total chunks uploaded
   */
  on(event: 'progress', listener: ({ size, total }: { size: number; total: number }) => void): this
}
