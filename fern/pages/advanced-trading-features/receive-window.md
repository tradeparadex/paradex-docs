# ⏲️ Receive Window

The `recv_window` parameter specifies the number of milliseconds the signature timestamp is valid  after the submission time. If not specified, this is currently set to 3600000 ms (1hr) by default.

`Condition : If current_time > recv_window + signature_time → reject the order`